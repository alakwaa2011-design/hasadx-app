import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import {
  CheckCircle, AlertTriangle, MessageSquare, User, Send, Loader2,
  Clock, XCircle, Paperclip, Download, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BASE = import.meta.env.VITE_API_URL || "";

interface Attachment { name: string; objectPath: string; contentType: string; size: number; }

function attachIcon(ct: string) {
  if (ct.startsWith("image/")) return "🖼️";
  if (ct === "application/pdf") return "📄";
  if (ct.includes("word")) return "📝";
  if (ct.includes("sheet") || ct.includes("excel")) return "📊";
  if (ct.includes("presentation") || ct.includes("powerpoint")) return "📑";
  return "📎";
}
function attachSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function isImage(ct: string) { return ct.startsWith("image/"); }
function isPdf(ct: string) { return ct === "application/pdf"; }
function isDocument(ct: string) {
  return ct.includes("word") || ct.includes("sheet") || ct.includes("excel") ||
    ct.includes("presentation") || ct.includes("powerpoint");
}

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
  teacherName: string; replies: Reply[]; attachments: string | null;
}

// ── Inline attachment viewer ────────────────────────────────
function AttachmentViewer({
  attachments, initialIndex, onClose,
}: { attachments: Attachment[]; initialIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(initialIndex);
  const att = attachments[idx];
  const url = `${BASE}/api/storage${att.objectPath}`;

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx(i => Math.min(attachments.length - 1, i + 1)), [attachments.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") next();
      if (e.key === "ArrowRight") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  const docViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.82)",
        display: "flex", flexDirection: "column",
        direction: "rtl",
      }}
      onClick={onClose}>

      {/* Toolbar */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(0,0,0,0.5)" }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ border: "none", background: "rgba(255,255,255,0.15)", borderRadius: 8, color: "#fff", cursor: "pointer", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={18} />
        </button>

        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {attachIcon(att.contentType)} {att.name}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
            {attachSize(att.size)}
            {attachments.length > 1 && ` · ${idx + 1} / ${attachments.length}`}
          </div>
        </div>

        <a href={url} download={att.name} onClick={e => e.stopPropagation()}
          style={{ border: "none", background: C.green, borderRadius: 8, color: "#fff", cursor: "pointer", padding: "7px 14px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, textDecoration: "none", fontFamily: "inherit" }}>
          <Download size={13} /> تحميل
        </a>
      </div>

      {/* Navigation arrows (multi-file) */}
      {attachments.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); prev(); }}
            disabled={idx === 0}
            style={{ position: "absolute", top: "50%", right: 12, transform: "translateY(-50%)", border: "none", background: "rgba(255,255,255,0.15)", borderRadius: "50%", color: "#fff", cursor: idx === 0 ? "default" : "pointer", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", opacity: idx === 0 ? 0.3 : 1, zIndex: 10 }}>
            <ChevronRight size={22} />
          </button>
          <button onClick={e => { e.stopPropagation(); next(); }}
            disabled={idx === attachments.length - 1}
            style={{ position: "absolute", top: "50%", left: 12, transform: "translateY(-50%)", border: "none", background: "rgba(255,255,255,0.15)", borderRadius: "50%", color: "#fff", cursor: idx === attachments.length - 1 ? "default" : "pointer", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", opacity: idx === attachments.length - 1 ? 0.3 : 1, zIndex: 10 }}>
            <ChevronLeft size={22} />
          </button>
        </>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 60px" }}
        onClick={e => e.stopPropagation()}>

        {isImage(att.contentType) && (
          <img src={url} alt={att.name}
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 10, objectFit: "contain", boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }} />
        )}

        {isPdf(att.contentType) && (
          <iframe src={url} title={att.name}
            style={{ width: "100%", height: "100%", border: "none", borderRadius: 8, background: "#fff" }} />
        )}

        {isDocument(att.contentType) && (
          <iframe src={docViewerUrl} title={att.name}
            style={{ width: "100%", height: "100%", border: "none", borderRadius: 8, background: "#fff" }} />
        )}

        {!isImage(att.contentType) && !isPdf(att.contentType) && !isDocument(att.contentType) && (
          <div style={{ textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>📎</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{att.name}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 20 }}>{attachSize(att.size)}</div>
            <a href={url} download={att.name}
              style={{ background: C.green, color: "#fff", padding: "12px 28px", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
              <Download size={15} /> تحميل الملف
            </a>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Attachment list inside thread ───────────────────────────
function AttachmentList({ attachments, onOpen }: { attachments: Attachment[]; onOpen: (i: number) => void }) {
  if (!attachments.length) return null;
  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: "flex", alignItems: "center", gap: 5 }}>
        <Paperclip size={11} /> المرفقات ({attachments.length})
      </div>
      {attachments.map((att, i) => (
        <button key={i} onClick={() => onOpen(i)}
          style={{ display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer", textAlign: "right", width: "100%", fontFamily: "inherit" }}>
          <span style={{ fontSize: 17 }}>{attachIcon(att.contentType)}</span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: C.text }}>
            {att.name}
          </span>
          <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{attachSize(att.size)}</span>
        </button>
      ))}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────
export default function ParentPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<MessageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [localReplies, setLocalReplies] = useState<Reply[]>([]);
  const [viewer, setViewer] = useState<{ attachments: Attachment[]; index: number } | null>(null);

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

  function openViewer(attachments: Attachment[], index: number) {
    setViewer({ attachments, index });
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

  let parsedAttachments: Attachment[] = [];
  try { if (data.attachments) parsedAttachments = JSON.parse(data.attachments); } catch {}

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

        {/* Thread */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          style={{ background: C.card, borderRadius: 14, padding: "18px 20px", marginBottom: 14, border: `1px solid ${C.border}`, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
            <MessageSquare size={15} style={{ color: C.green }} /> المحادثة
          </div>

          {/* Original teacher message */}
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
            {parsedAttachments.length > 0 && (
              <AttachmentList attachments={parsedAttachments} onOpen={i => openViewer(parsedAttachments, i)} />
            )}
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

        {/* Reply box — always visible, same page */}
        {!data.expired ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            style={{ background: C.card, borderRadius: 14, padding: "18px 20px", border: `1px solid ${C.border}`, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            {sent ? (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <CheckCircle size={32} style={{ color: C.green, margin: "0 auto 10px", display: "block" }} />
                <p style={{ fontSize: 15, fontWeight: 700, color: C.green }}>تم إرسال ردك ✓</p>
                <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>سيصل للمعلم {data.teacherName} فور الاستلام</p>
                <button onClick={() => setSent(false)}
                  style={{ marginTop: 14, padding: "9px 20px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>
                  إضافة رد آخر
                </button>
              </div>
            ) : (
              <>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
                  <Send size={14} style={{ color: C.green }} /> ردّ على المعلم
                </h3>
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={4}
                  placeholder="اكتب ردك هنا..."
                  style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, fontFamily: "inherit", resize: "vertical", outline: "none", background: C.surface, color: C.text, lineHeight: 1.6, transition: "border-color 0.2s", boxSizing: "border-box" }}
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

      {/* Inline attachment viewer */}
      <AnimatePresence>
        {viewer && (
          <AttachmentViewer
            attachments={viewer.attachments}
            initialIndex={viewer.index}
            onClose={() => setViewer(null)}
          />
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
