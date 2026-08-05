import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearch } from "wouter";
import { Layout } from "@/components/layout";
import {
  MessageSquare, Plus, Send, X, Search, Loader2,
  Mail, User, Reply, Archive, AlertCircle,
  MailOpen, RotateCcw, ChevronDown, ChevronUp,
  FileText, Clock, CheckCircle2, XCircle, Users,
  Paperclip, Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/components/ui/sonner";

const BASE = import.meta.env.VITE_API_URL || "";

const C = {
  green: "#1E4D35", greenLight: "#265E42", gold: "#C9A050",
  bg: "#F0EDE7", card: "#FFFFFF", surface: "#F7F5F1",
  border: "#E5E0D8", text: "#1a1a1a", muted: "#666",
};

// ── Message Templates ───────────────────────────────────────
const TEMPLATES = [
  {
    id: "absence", label: "غياب", icon: "🚫",
    subject: "غياب {{اسم الطالب}}",
    body: "السلام عليكم ورحمة الله،\n\nأودّ إعلامكم بأن الطالب/ة {{اسم الطالب}} لم يحضر/تحضر اليوم.\n\nيُرجى التواصل معي لمعرفة السبب وتوضيح أي ملاحظات.\n\nشكراً لمتابعتكم.",
  },
  {
    id: "late", label: "تأخر", icon: "⏰",
    subject: "تأخر {{اسم الطالب}} عن الحصص",
    body: "السلام عليكم ورحمة الله،\n\nأودّ إعلامكم بأن الطالب/ة {{اسم الطالب}} تأخّر/ت عن حضور الحصص مؤخراً.\n\nنرجو الحرص على الحضور في الوقت المحدد، وإعلامي بأي ظروف طارئة.\n\nشكراً لتعاونكم.",
  },
  {
    id: "homework", label: "واجب غير مكتمل", icon: "📝",
    subject: "واجب غير مكتمل — {{اسم الطالب}}",
    body: "السلام عليكم ورحمة الله،\n\nأودّ لفت انتباهكم إلى أن الطالب/ة {{اسم الطالب}} لم يُكمل/تُكمل الواجبات المطلوبة.\n\nيُرجى المتابعة معه/ها في المنزل والحرص على إتمام الواجبات في مواعيدها.\n\nأنا متاح/ة لأي استفسار.",
  },
  {
    id: "excellence", label: "تميز", icon: "⭐",
    subject: "مبروك — تميّز {{اسم الطالب}}!",
    body: "السلام عليكم ورحمة الله،\n\nيسعدني أن أُبشّركم بأن الطالب/ة {{اسم الطالب}} أبدى/أبدت أداءً متميزاً ومثيراً للإعجاب.\n\nنتمنى له/لها مزيداً من التقدم والتفوق، وبارك الله في جهودكم في تربيته/تربيتها.\n\nتحياتي وتقديري.",
  },
  {
    id: "thanks", label: "شكر", icon: "🙏",
    subject: "شكر وتقدير — {{اسم الطالب}}",
    body: "السلام عليكم ورحمة الله،\n\nأودّ أن أتوجه إليكم بخالص الشكر والتقدير على متابعتكم الدائمة لمسيرة الطالب/ة {{اسم الطالب}} التعليمية.\n\nتعاونكم معنا يُشكّل فارقاً حقيقياً، ونقدّر دعمكم الكبير.\n\nدمتم في أمان الله.",
  },
  {
    id: "behavior", label: "ملاحظة سلوكية", icon: "⚠️",
    subject: "ملاحظة سلوكية — {{اسم الطالب}}",
    body: "السلام عليكم ورحمة الله،\n\nأودّ إحاطتكم علماً بأن الطالب/ة {{اسم الطالب}} صدر منه/منها بعض التصرفات التي تستدعي الانتباه داخل الفصل.\n\nنأمل منكم التحدث معه/معها والتوجيه المناسب، وأنا بدوري سأتابع الأمر عن كثب.\n\nشكراً لتفاعلكم.",
  },
  {
    id: "meeting", label: "طلب مقابلة", icon: "📅",
    subject: "طلب مقابلة — {{اسم الطالب}}",
    body: "السلام عليكم ورحمة الله،\n\nأودّ التواصل معكم لترتيب موعد مقابلة مناسب للحديث عن أداء الطالب/ة {{اسم الطالب}} ووضعه/ا الدراسي.\n\nيُرجى إخباري بالوقت المناسب لكم وسأعمل على توفيره.\n\nشكراً لاهتمامكم.",
  },
];

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

interface Student {
  id: number; name: string; gradeLevel: string | null;
  studentClass: string | null; parentPhone: string | null;
  parentName: string | null; parentEmail: string | null;
}

interface Reply {
  id: number; messageId: number; sender: "teacher" | "parent";
  body: string; attachments?: string | null; createdAt: string;
}

interface Message {
  id: number; studentId: number; studentName: string;
  studentClass: string | null; gradeLevel: string | null;
  subject: string; body: string; parentEmail: string; parentName: string | null;
  sentAt: string; readAt: string | null; replyText: string | null;
  repliedAt: string | null; tokenExpiresAt: string; isArchived: boolean;
  hasUnreadReply: boolean; attachments: string | null;
}

type MsgStatus = "expired" | "replied" | "read" | "sent";
function getStatus(msg: Message): MsgStatus {
  if (new Date(msg.tokenExpiresAt) < new Date()) return "expired";
  if (msg.repliedAt) return "replied";
  if (msg.readAt) return "read";
  return "sent";
}
function statusBadge(msg: Message) {
  const s = getStatus(msg);
  if (s === "expired") return { label: "انتهت الصلاحية", color: "#9ca3af", bg: "#f3f4f6", icon: <XCircle size={11} /> };
  if (s === "replied") return { label: "رُدّ عليها", color: C.green, bg: "#e8f4ed", icon: <Reply size={11} /> };
  if (s === "read") return { label: "مقروءة", color: "#2563eb", bg: "#eff6ff", icon: <MailOpen size={11} /> };
  return { label: "مُرسَلة", color: C.gold, bg: "#fef9ec", icon: <Mail size={11} /> };
}

export default function ParentMessagesPage() {
  const searchStr = useSearch();
  const targetMessageId = useMemo(() => {
    const params = new URLSearchParams(searchStr);
    const v = params.get("message");
    return v ? parseInt(v, 10) : null;
  }, [searchStr]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"inbox" | "archived">("inbox");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [threads, setThreads] = useState<Record<number, Reply[]>>({});
  const [threadLoading, setThreadLoading] = useState<Record<number, boolean>>({});
  const [teacherReplyDraft, setTeacherReplyDraft] = useState<Record<number, string>>({});
  const [sendingReply, setSendingReply] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [showBulkCompose, setShowBulkCompose] = useState(false);

  // Bulk compose
  const [bulkClassFilter, setBulkClassFilter] = useState<string>("__all__");
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkBody, setBulkBody] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ sent: number; skipped: number; failed: number } | null>(null);

  // Compose
  const [composeStudentId, setComposeStudentId] = useState<number | "">("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeParentEmail, setComposeParentEmail] = useState("");
  const [composeParentName, setComposeParentName] = useState("");
  const [composeSending, setComposeSending] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

  // Attachment state
  const [composeAttachments, setComposeAttachments] = useState<Attachment[]>([]);
  const [composeUploadingCount, setComposeUploadingCount] = useState(0);
  const [bulkAttachments, setBulkAttachments] = useState<Attachment[]>([]);
  const [bulkUploadingCount, setBulkUploadingCount] = useState(0);
  // Reply attachment state (keyed by message id)
  const [replyAttachments, setReplyAttachments] = useState<Record<number, Attachment[]>>({});
  const [replyUploadingCount, setReplyUploadingCount] = useState<Record<number, number>>({});

  const fetchMessages = useCallback(async (archived = false) => {
    setLoading(true);
    const r = await fetch(`${BASE}/api/parent-messages?archived=${archived}`, { credentials: "include" });
    if (r.ok) setMessages(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch(`${BASE}/api/students`, { credentials: "include" })
      .then(r => r.ok ? r.json() : []).then(setStudents);
    fetchMessages(false);
  }, [fetchMessages]);

  useEffect(() => { fetchMessages(tab === "archived"); }, [tab, fetchMessages]);

  // Auto-open a specific thread when arriving from a notification link
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (loading || !targetMessageId || messages.length === 0) return;
    const found = messages.find(m => m.id === targetMessageId);
    if (found) {
      autoOpenedRef.current = true;
      setExpandedId(targetMessageId);
      fetchThread(targetMessageId);
      // Scroll to the message after a short delay
      setTimeout(() => {
        const el = document.getElementById(`msg-${targetMessageId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [loading, messages, targetMessageId]);

  // Auto-fill parent info
  useEffect(() => {
    if (!composeStudentId) return;
    const s = students.find(x => x.id === composeStudentId);
    if (s) {
      if (s.parentEmail) setComposeParentEmail(s.parentEmail);
      if (s.parentName) setComposeParentName(s.parentName);
    }
  }, [composeStudentId, students]);

  const fetchThread = async (msgId: number) => {
    if (threads[msgId]) return;
    setThreadLoading(prev => ({ ...prev, [msgId]: true }));
    try {
      const r = await fetch(`${BASE}/api/parent-messages/${msgId}/thread`, { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        setThreads(prev => ({ ...prev, [msgId]: data.replies }));
      }
    } finally {
      setThreadLoading(prev => ({ ...prev, [msgId]: false }));
    }
  };

  const toggleExpand = (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    fetchThread(id);
  };

  const applyTemplate = (tpl: typeof TEMPLATES[0], studentName: string) => {
    const fill = (s: string) => s.replace(/\{\{اسم الطالب\}\}/g, studentName || "الطالب");
    setComposeSubject(fill(tpl.subject));
    setComposeBody(fill(tpl.body));
    setActiveTemplate(tpl.id);
  };

  // Update template body when student changes
  const composeStudent = students.find(s => s.id === composeStudentId);
  const prevStudentRef = useRef<string>("");
  useEffect(() => {
    const newName = composeStudent?.name || "";
    if (activeTemplate && newName && prevStudentRef.current !== newName) {
      const tpl = TEMPLATES.find(t => t.id === activeTemplate);
      if (tpl) applyTemplate(tpl, newName);
    }
    prevStudentRef.current = newName;
  }, [composeStudentId, composeStudent?.name, activeTemplate]);

  async function handleSend() {
    if (!composeStudentId || !composeBody.trim() || !composeParentEmail.trim()) return;
    setComposeSending(true);
    try {
      const r = await fetch(`${BASE}/api/parent-messages`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: composeStudentId, subject: composeSubject || "رسالة من المعلم",
          body: composeBody, parentEmail: composeParentEmail, parentName: composeParentName || undefined,
          attachments: composeAttachments.length > 0 ? composeAttachments : undefined,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "حدث خطأ");
      toast.success("تم إرسال الرسالة بنجاح ✉️");
      setShowCompose(false);
      resetCompose();
      fetchMessages(false);
    } catch (e: any) { toast.error(e.message || "حدث خطأ"); }
    finally { setComposeSending(false); }
  }

  function resetCompose() {
    setComposeStudentId(""); setComposeSubject(""); setComposeBody("");
    setComposeParentEmail(""); setComposeParentName(""); setStudentSearch("");
    setActiveTemplate(null); setComposeAttachments([]);
  }

  function resetBulk() {
    setBulkClassFilter("__all__"); setBulkSubject(""); setBulkBody("");
    setBulkResult(null); setBulkAttachments([]);
  }

  async function handleBulkSend() {
    if (!bulkBody.trim()) return;
    setBulkSending(true); setBulkResult(null);
    try {
      const r = await fetch(`${BASE}/api/parent-messages/bulk`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classFilter: bulkClassFilter === "__all__" ? null : bulkClassFilter,
          subject: bulkSubject || "رسالة من المعلم",
          body: bulkBody,
          attachments: bulkAttachments.length > 0 ? bulkAttachments : undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "حدث خطأ");
      setBulkResult(data);
      fetchMessages(false);
      toast.success(`تم الإرسال — ${data.sent} رسالة`);
    } catch (e: any) { toast.error(e.message || "حدث خطأ"); }
    finally { setBulkSending(false); }
  }

  // Unique classes from students list
  const uniqueClasses = Array.from(new Set(students.map(s => s.studentClass).filter(Boolean))) as string[];

  // ── Attachment upload helpers ───────────────────────────────
  async function uploadAttachmentFile(file: File): Promise<Attachment | null> {
    try {
      const r = await fetch(`${BASE}/api/storage/uploads/request-attachment-url`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!r.ok) { toast.error((await r.json()).error || "فشل رفع الملف"); return null; }
      const { uploadURL, objectPath } = await r.json();
      const up = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!up.ok) { toast.error("فشل رفع الملف إلى التخزين"); return null; }
      return { name: file.name, objectPath, contentType: file.type, size: file.size };
    } catch { toast.error("فشل رفع الملف"); return null; }
  }

  async function handleComposeFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const toUpload = files.slice(0, 5 - composeAttachments.length);
    setComposeUploadingCount(c => c + toUpload.length);
    for (const file of toUpload) {
      const att = await uploadAttachmentFile(file);
      if (att) setComposeAttachments(prev => [...prev, att]);
      setComposeUploadingCount(c => Math.max(0, c - 1));
    }
  }

  async function handleBulkFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const toUpload = files.slice(0, 5 - bulkAttachments.length);
    setBulkUploadingCount(c => c + toUpload.length);
    for (const file of toUpload) {
      const att = await uploadAttachmentFile(file);
      if (att) setBulkAttachments(prev => [...prev, att]);
      setBulkUploadingCount(c => Math.max(0, c - 1));
    }
  }

  async function handleReplyFileChange(msgId: number, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const current = replyAttachments[msgId] || [];
    const toUpload = files.slice(0, 5 - current.length);
    setReplyUploadingCount(prev => ({ ...prev, [msgId]: (prev[msgId] || 0) + toUpload.length }));
    for (const file of toUpload) {
      const att = await uploadAttachmentFile(file);
      if (att) setReplyAttachments(prev => ({ ...prev, [msgId]: [...(prev[msgId] || []), att] }));
      setReplyUploadingCount(prev => ({ ...prev, [msgId]: Math.max(0, (prev[msgId] || 1) - 1) }));
    }
  }

  async function handleTeacherReply(msgId: number) {
    const body = teacherReplyDraft[msgId]?.trim();
    if (!body) return;
    setSendingReply(prev => ({ ...prev, [msgId]: true }));
    const atts = replyAttachments[msgId] || [];
    try {
      const r = await fetch(`${BASE}/api/parent-messages/${msgId}/teacher-reply`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, attachments: atts.length > 0 ? atts : undefined }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "حدث خطأ");
      const newReply = await r.json();
      setThreads(prev => ({ ...prev, [msgId]: [...(prev[msgId] || []), newReply] }));
      setTeacherReplyDraft(prev => ({ ...prev, [msgId]: "" }));
      setReplyAttachments(prev => ({ ...prev, [msgId]: [] }));
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, hasUnreadReply: false } : m));
      toast.success("تم إرسال الرد");
    } catch (e: any) { toast.error(e.message || "حدث خطأ"); }
    finally { setSendingReply(prev => ({ ...prev, [msgId]: false })); }
  }

  async function handleArchive(id: number) {
    await fetch(`${BASE}/api/parent-messages/${id}`, { method: "DELETE", credentials: "include" });
    setMessages(prev => prev.filter(m => m.id !== id));
    if (expandedId === id) setExpandedId(null);
    toast.success("تمت أرشفة الرسالة");
  }

  async function handleRestore(id: number) {
    await fetch(`${BASE}/api/parent-messages/${id}/restore`, { method: "PATCH", credentials: "include" });
    setMessages(prev => prev.filter(m => m.id !== id));
    if (expandedId === id) setExpandedId(null);
    toast.success("تمت استعادة الرسالة");
  }

  const filtered = messages.filter(m =>
    !search || m.studentName.includes(search) || m.subject.includes(search) || m.parentEmail.includes(search)
  );
  const filteredStudents = students.filter(s => !studentSearch || s.name.includes(studentSearch) || (s.studentClass || "").includes(studentSearch));
  const studentsWithNoEmail = students.filter(s => !s.parentEmail).length;

  return (
    <Layout>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px", direction: "rtl", fontFamily: "'Tajawal', sans-serif" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.green, margin: 0 }}>رسائل أولياء الأمور</h1>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>أرسل رسائل لأولياء الأمور وتابع ردودهم</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowBulkCompose(true)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", background: "#fff", color: C.green, border: `1.5px solid ${C.green}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              <Users size={15} /> رسالة جماعية
            </button>
            <button onClick={() => setShowCompose(true)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: C.green, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              <Plus size={16} /> رسالة جديدة
            </button>
          </div>
        </div>

        {/* Warning */}
        {studentsWithNoEmail > 0 && (
          <div style={{ background: "#fef9ec", border: `1px solid ${C.gold}`, borderRadius: 12, padding: "11px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#92670a" }}>
            <AlertCircle size={15} style={{ color: C.gold, flexShrink: 0 }} />
            <span><strong>{studentsWithNoEmail} طالب</strong> بدون إيميل ولي أمر — أضفه من صفحة الطلاب</span>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, background: C.surface, borderRadius: 10, padding: 4, border: `1px solid ${C.border}` }}>
          {(["inbox", "archived"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", background: tab === t ? C.green : "transparent", color: tab === t ? "#fff" : C.muted, transition: "all 0.15s" }}>
              {t === "inbox" ? "📥 الصندوق" : "📁 الأرشيف"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: C.muted, pointerEvents: "none" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
            style={{ width: "100%", padding: "9px 36px 9px 12px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontFamily: "inherit", background: C.surface, color: C.text, outline: "none" }} />
        </div>

        {/* Message List */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Loader2 size={28} style={{ color: C.green, animation: "spin 1s linear infinite", display: "block", margin: "0 auto" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: C.muted }}>
            <MessageSquare size={40} style={{ margin: "0 auto 12px", opacity: 0.3, display: "block" }} />
            <p style={{ fontSize: 15, fontWeight: 700 }}>{tab === "archived" ? "لا توجد رسائل مؤرشفة" : "لا توجد رسائل"}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(msg => {
              const status = statusBadge(msg);
              const isOpen = expandedId === msg.id;
              const thread = threads[msg.id] || [];
              const tLoading = threadLoading[msg.id];
              return (
                <motion.div key={msg.id} id={`msg-${msg.id}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  style={{ background: isOpen ? "#f0f7f3" : C.card, border: `1px solid ${isOpen ? C.green : C.border}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.15s" }}>

                  {/* Message Header */}
                  <div style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                    onClick={() => toggleExpand(msg.id)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{msg.studentName}</span>
                        {(msg.studentClass || msg.gradeLevel) && (
                          <span style={{ fontSize: 11, color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "1px 7px" }}>
                            {[msg.gradeLevel, msg.studentClass].filter(Boolean).join(" — ")}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{msg.subject}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        {new Date(msg.sentAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      {msg.hasUnreadReply && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#fff7ed", color: "#c2730a", border: "1px solid #fcd89a" }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", display: "inline-block", flexShrink: 0 }} />
                          رد جديد
                        </span>
                      )}
                      <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: status.bg, color: status.color }}>
                        {status.icon} {status.label}
                      </span>
                      {tab === "inbox" ? (
                        <button onClick={e => { e.stopPropagation(); handleArchive(msg.id); }}
                          style={{ padding: 5, borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", color: C.muted }} title="أرشفة">
                          <Archive size={13} />
                        </button>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); handleRestore(msg.id); }}
                          style={{ padding: 5, borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", color: C.green }} title="استعادة">
                          <RotateCcw size={13} />
                        </button>
                      )}
                      {isOpen ? <ChevronUp size={14} style={{ color: C.muted }} /> : <ChevronDown size={14} style={{ color: C.muted }} />}
                    </div>
                  </div>

                  {/* Thread Expansion */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: "hidden" }}>
                        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.border}` }}>

                          {/* Original message */}
                          <div style={{ marginTop: 14, marginBottom: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                              <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <User size={13} style={{ color: "#fff" }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>أنت (المعلم)</span>
                              <span style={{ fontSize: 11, color: C.muted }}>{new Date(msg.sentAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <div style={{ background: C.surface, borderRadius: 10, padding: "12px 14px", fontSize: 14, lineHeight: 1.75, color: C.text, whiteSpace: "pre-wrap", borderRight: `3px solid ${C.gold}` }}>
                              {msg.body}
                            </div>
                            {msg.attachments && (() => {
                              try {
                                const atts: Attachment[] = JSON.parse(msg.attachments);
                                if (!atts.length) return null;
                                return (
                                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                                    {atts.map((att, i) => (
                                      <a key={i} href={`${BASE}/api/storage${att.objectPath}`} target="_blank" rel="noopener noreferrer"
                                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, textDecoration: "none" }}>
                                        <span style={{ fontSize: 15 }}>{attachIcon(att.contentType)}</span>
                                        <span style={{ flex: 1, fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name}</span>
                                        <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{attachSize(att.size)}</span>
                                        <Download size={12} style={{ color: C.green, flexShrink: 0 }} />
                                      </a>
                                    ))}
                                  </div>
                                );
                              } catch { return null; }
                            })()}
                          </div>

                          {/* Thread replies */}
                          {tLoading ? (
                            <div style={{ textAlign: "center", padding: 16 }}>
                              <Loader2 size={18} style={{ color: C.green, animation: "spin 1s linear infinite" }} />
                            </div>
                          ) : (
                            thread.map((reply, i) => {
                              let replyAtts: Attachment[] = [];
                              try { if (reply.attachments) replyAtts = JSON.parse(reply.attachments); } catch {}
                              return (
                                <div key={i} style={{ marginBottom: 12 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: reply.sender === "teacher" ? C.green : "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      {reply.sender === "teacher"
                                        ? <User size={13} style={{ color: "#fff" }} />
                                        : <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>و</span>}
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: reply.sender === "teacher" ? C.green : "#2563eb" }}>
                                      {reply.sender === "teacher" ? "أنت (المعلم)" : `${msg.parentName || "ولي الأمر"}`}
                                    </span>
                                    <span style={{ fontSize: 11, color: C.muted }}>
                                      {new Date(reply.createdAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </div>
                                  <div style={{
                                    background: reply.sender === "teacher" ? C.surface : "#f0f7ff",
                                    borderRadius: 10, padding: "12px 14px", fontSize: 14, lineHeight: 1.75,
                                    color: C.text, whiteSpace: "pre-wrap",
                                    borderRight: `3px solid ${reply.sender === "teacher" ? C.gold : "#3b82f6"}`,
                                  }}>
                                    {reply.body}
                                  </div>
                                  {replyAtts.length > 0 && (
                                    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                                      {replyAtts.map((att, j) => (
                                        <a key={j} href={`${BASE}/api/storage${att.objectPath}`} target="_blank" rel="noopener noreferrer"
                                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, textDecoration: "none" }}>
                                          <span style={{ fontSize: 15 }}>{attachIcon(att.contentType)}</span>
                                          <span style={{ flex: 1, fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name}</span>
                                          <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{attachSize(att.size)}</span>
                                          <Download size={12} style={{ color: C.green, flexShrink: 0 }} />
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}

                          {/* Teacher reply input */}
                          {tab === "inbox" && getStatus(msg) !== "expired" && (
                            <div style={{ marginTop: 12 }}>
                              <div style={{ display: "flex", gap: 8 }}>
                                <textarea
                                  value={teacherReplyDraft[msg.id] || ""}
                                  onChange={e => setTeacherReplyDraft(prev => ({ ...prev, [msg.id]: e.target.value }))}
                                  rows={2} placeholder="اكتب ردك هنا..."
                                  style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", background: C.card, color: C.text, resize: "none", outline: "none" }}
                                />
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  <label title="إرفاق ملف" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, cursor: (replyAttachments[msg.id] || []).length >= 5 ? "not-allowed" : "pointer", opacity: (replyAttachments[msg.id] || []).length >= 5 ? 0.4 : 1 }}>
                                    <Paperclip size={15} style={{ color: C.muted }} />
                                    <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" style={{ display: "none" }} disabled={(replyAttachments[msg.id] || []).length >= 5} onChange={e => handleReplyFileChange(msg.id, e)} />
                                  </label>
                                  <button onClick={() => handleTeacherReply(msg.id)}
                                    disabled={sendingReply[msg.id] || !teacherReplyDraft[msg.id]?.trim() || (replyUploadingCount[msg.id] || 0) > 0}
                                    style={{ padding: "8px 14px", background: C.green, color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontFamily: "inherit", opacity: (sendingReply[msg.id] || !teacherReplyDraft[msg.id]?.trim() || (replyUploadingCount[msg.id] || 0) > 0) ? 0.5 : 1 }}>
                                    {sendingReply[msg.id] ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
                                    رد
                                  </button>
                                </div>
                              </div>
                              {/* Reply attachments preview */}
                              {((replyAttachments[msg.id] || []).length > 0 || (replyUploadingCount[msg.id] || 0) > 0) && (
                                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                                  {(replyUploadingCount[msg.id] || 0) > 0 && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted }}>
                                      <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> جارٍ الرفع...
                                    </div>
                                  )}
                                  {(replyAttachments[msg.id] || []).map((att, j) => (
                                    <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
                                      <span style={{ fontSize: 14 }}>{attachIcon(att.contentType)}</span>
                                      <span style={{ flex: 1, fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name}</span>
                                      <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{attachSize(att.size)}</span>
                                      <button onClick={() => setReplyAttachments(prev => ({ ...prev, [msg.id]: (prev[msg.id] || []).filter((_, k) => k !== j) }))} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.muted, padding: 2, display: "flex", alignItems: "center" }}><X size={12} /></button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {getStatus(msg) === "expired" && (
                            <div style={{ marginTop: 8, textAlign: "center", fontSize: 12, color: "#9ca3af", padding: "8px 12px", background: "#f9fafb", borderRadius: 8 }}>
                              انتهت صلاحية هذه المحادثة — لا يمكن إضافة ردود جديدة
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bulk Compose Modal ─────────────────────────────── */}
      <AnimatePresence>
        {showBulkCompose && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "16px", overflowY: "auto", direction: "rtl" }}
            onClick={() => { setShowBulkCompose(false); resetBulk(); }}>
            <motion.div initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92 }}
              style={{ background: C.card, borderRadius: 18, padding: 28, maxWidth: 520, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", marginTop: 20 }}
              onClick={e => e.stopPropagation()}>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: C.green, display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                  <Users size={18} /> رسالة جماعية لأولياء الأمور
                </h3>
                <button onClick={() => { setShowBulkCompose(false); resetBulk(); }} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.muted }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Class selector */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 }}>الصف المستهدف</label>
                  <select value={bulkClassFilter} onChange={e => setBulkClassFilter(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, fontFamily: "inherit", background: C.surface, color: C.text, outline: "none", appearance: "none" }}>
                    <option value="__all__">جميع الصفوف ({students.filter(s => s.parentEmail).length} ولي أمر)</option>
                    {uniqueClasses.map(cls => (
                      <option key={cls} value={cls}>
                        {cls} ({students.filter(s => s.studentClass === cls && s.parentEmail).length} ولي أمر)
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>
                    ⚠️ يُرسَل فقط إلى الطلاب الذين لديهم إيميل ولي أمر مسجّل.
                  </p>
                </div>

                {/* Subject */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>الموضوع</label>
                  <input value={bulkSubject} onChange={e => setBulkSubject(e.target.value)} placeholder="رسالة من المعلم"
                    style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, fontFamily: "inherit", background: C.surface, color: C.text, outline: "none" }} />
                </div>

                {/* Body */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>نص الرسالة *</label>
                  <textarea value={bulkBody} onChange={e => setBulkBody(e.target.value)} rows={5} placeholder="اكتب الرسالة هنا — ستصل لجميع أولياء الأمور المحددين..."
                    style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 14, fontFamily: "inherit", background: C.surface, color: C.text, outline: "none", resize: "vertical", lineHeight: 1.65 }} />
                </div>

                {/* Attachments */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 }}>المرفقات (اختياري — حتى 5 ملفات، 20 MB لكل ملف)</label>
                  {bulkAttachments.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                      {bulkAttachments.map((att, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 15 }}>{attachIcon(att.contentType)}</span>
                          <span style={{ flex: 1, fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name}</span>
                          <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{attachSize(att.size)}</span>
                          <button onClick={() => setBulkAttachments(prev => prev.filter((_, j) => j !== i))} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.muted, padding: 2, display: "flex", alignItems: "center" }}><X size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {bulkUploadingCount > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted, marginBottom: 8 }}>
                      <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> جارٍ الرفع...
                    </div>
                  )}
                  {bulkAttachments.length < 5 && (
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 8, cursor: "pointer", fontSize: 12, color: C.muted, fontFamily: "inherit" }}>
                      <Paperclip size={13} /> إضافة مرفق
                      <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" style={{ display: "none" }} onChange={handleBulkFileChange} />
                    </label>
                  )}
                </div>

                {/* Result */}
                {bulkResult && (
                  <div style={{ background: "#e8f4ed", border: `1px solid ${C.green}`, borderRadius: 10, padding: "12px 14px", fontSize: 13, color: C.green, fontWeight: 700 }}>
                    ✅ أُرسل {bulkResult.sent} رسالة
                    {bulkResult.skipped > 0 && ` · ${bulkResult.skipped} بدون إيميل`}
                    {bulkResult.failed > 0 && ` · ${bulkResult.failed} فشل`}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleBulkSend} disabled={bulkSending || !bulkBody.trim() || bulkUploadingCount > 0}
                    style={{ flex: 1, padding: "11px", background: C.green, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: (bulkSending || !bulkBody.trim()) ? 0.5 : 1 }}>
                    {bulkSending ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={15} />}
                    {bulkSending ? "جارٍ الإرسال..." : "إرسال للجميع"}
                  </button>
                  <button onClick={() => { setShowBulkCompose(false); resetBulk(); }}
                    style={{ flex: 1, padding: "11px", background: C.surface, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>
                    إغلاق
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Compose Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {showCompose && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "16px 16px", overflowY: "auto", direction: "rtl" }}
            onClick={() => { setShowCompose(false); resetCompose(); }}>
            <motion.div initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92 }}
              style={{ background: C.card, borderRadius: 18, padding: 28, maxWidth: 540, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", marginTop: 20 }}
              onClick={e => e.stopPropagation()}>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: C.green, display: "flex", alignItems: "center", gap: 8 }}>
                  <Send size={18} /> رسالة جديدة
                </h3>
                <button onClick={() => { setShowCompose(false); resetCompose(); }} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.muted }}>
                  <X size={20} />
                </button>
              </div>

              {/* Template picker */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                  <FileText size={12} /> قوالب جاهزة
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TEMPLATES.map(tpl => (
                    <button key={tpl.id} onClick={() => applyTemplate(tpl, composeStudent?.name || "")}
                      style={{
                        padding: "5px 11px", borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                        border: `1px solid ${activeTemplate === tpl.id ? C.green : C.border}`,
                        background: activeTemplate === tpl.id ? "#e8f4ed" : C.surface,
                        color: activeTemplate === tpl.id ? C.green : C.muted,
                        cursor: "pointer", transition: "all 0.15s",
                      }}>
                      {tpl.icon} {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {/* Student */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 }}>الطالب *</label>
                  <div style={{ position: "relative", marginBottom: 6 }}>
                    <Search size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: C.muted, pointerEvents: "none" }} />
                    <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="بحث..."
                      style={{ width: "100%", padding: "8px 32px 8px 10px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, fontFamily: "inherit", background: C.surface, color: C.text, outline: "none" }} />
                  </div>
                  <div style={{ maxHeight: 160, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 9, background: C.surface }}>
                    {filteredStudents.slice(0, 30).map(s => (
                      <button key={s.id} onClick={() => { setComposeStudentId(s.id); setStudentSearch(s.name); }}
                        style={{ width: "100%", textAlign: "right", padding: "8px 12px", border: "none", background: composeStudentId === s.id ? "#e8f4ed" : "transparent", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, color: C.text }}>
                        <span style={{ fontWeight: composeStudentId === s.id ? 700 : 400 }}>{s.name}</span>
                        <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
                          {s.studentClass && <span style={{ fontSize: 11, color: C.muted }}>{s.studentClass}</span>}
                          {s.parentEmail
                            ? <span style={{ fontSize: 10, color: C.green, background: "#e8f4ed", borderRadius: 4, padding: "1px 5px" }}>✓</span>
                            : <span style={{ fontSize: 10, color: "#e53e3e", background: "#fff5f5", borderRadius: 4, padding: "1px 5px" }}>بلا إيميل</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Parent email + name */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>إيميل ولي الأمر *</label>
                    <input value={composeParentEmail} onChange={e => setComposeParentEmail(e.target.value)} type="email" dir="ltr" placeholder="parent@mail.com"
                      style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, fontFamily: "inherit", background: C.surface, color: C.text, outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>اسم ولي الأمر</label>
                    <input value={composeParentName} onChange={e => setComposeParentName(e.target.value)} placeholder="اختياري"
                      style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, fontFamily: "inherit", background: C.surface, color: C.text, outline: "none" }} />
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>الموضوع</label>
                  <input value={composeSubject} onChange={e => { setComposeSubject(e.target.value); setActiveTemplate(null); }} placeholder="رسالة من المعلم"
                    style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, fontFamily: "inherit", background: C.surface, color: C.text, outline: "none" }} />
                </div>

                {/* Body */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 5 }}>نص الرسالة *</label>
                  <textarea value={composeBody} onChange={e => { setComposeBody(e.target.value); setActiveTemplate(null); }} rows={5} placeholder="اكتب رسالتك هنا..."
                    style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 14, fontFamily: "inherit", background: C.surface, color: C.text, outline: "none", resize: "vertical", lineHeight: 1.65 }} />
                </div>

                {/* Attachments */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 }}>المرفقات (اختياري — حتى 5 ملفات، 20 MB لكل ملف)</label>
                  {composeAttachments.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                      {composeAttachments.map((att, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 15 }}>{attachIcon(att.contentType)}</span>
                          <span style={{ flex: 1, fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name}</span>
                          <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{attachSize(att.size)}</span>
                          <button onClick={() => setComposeAttachments(prev => prev.filter((_, j) => j !== i))} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.muted, padding: 2, display: "flex", alignItems: "center" }}><X size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {composeUploadingCount > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted, marginBottom: 8 }}>
                      <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> جارٍ الرفع...
                    </div>
                  )}
                  {composeAttachments.length < 5 && (
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 8, cursor: "pointer", fontSize: 12, color: C.muted, fontFamily: "inherit" }}>
                      <Paperclip size={13} /> إضافة مرفق
                      <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" style={{ display: "none" }} onChange={handleComposeFileChange} />
                    </label>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleSend} disabled={composeSending || !composeStudentId || !composeBody.trim() || !composeParentEmail.trim() || composeUploadingCount > 0}
                    style={{ flex: 1, padding: "11px", background: C.green, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: (composeSending || !composeStudentId || !composeBody.trim() || !composeParentEmail.trim()) ? 0.5 : 1 }}>
                    {composeSending ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={15} />}
                    {composeSending ? "جارٍ الإرسال..." : "إرسال"}
                  </button>
                  <button onClick={() => { setShowCompose(false); resetCompose(); }}
                    style={{ flex: 1, padding: "11px", background: C.surface, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Layout>
  );
}
