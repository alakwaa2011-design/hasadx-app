import { useState } from "react";
import {
  Search, BookText, Video, Zap, Sparkles, ClipboardList,
  Play, Download, Copy, Bookmark, TrendingUp, Star,
  Users, Globe, ChevronLeft, SlidersHorizontal,
  Radio, LayoutGrid, List, X, Plus,
} from "lucide-react";

/* ─── Brand tokens ─── */
const C = {
  primary:   "#225739",
  primary2:  "#1c4630",
  soft:      "#e8f4ec",
  gold:      "#E8B84B",
  goldLight: "#fdf6e3",
  bg:        "#F8F6F1",
  card:      "#ffffff",
  border:    "#E9E4DB",
  text:      "#1F2D24",
  muted:     "#7A8C82",
  sidebar:   "#ffffff",
} as const;

/* ─── Mock data ─── */
const MOCK_ACTIVITIES = [
  { id: 1,  title: "اختبار الرياضيات — الأعداد الكسرية",       subject: "رياضيات",  grade: "الصف السادس",   type: "quiz",   questions: 20, uses: 1240, isNew: true,  isFeatured: true,  teacherName: "حصاد" },
  { id: 2,  title: "مسابقة وميض — النحو والصرف",               subject: "لغة عربية", grade: "الصف الخامس",  type: "live",   questions: 15, uses: 870,  isNew: true,  isFeatured: false, teacherName: "أ. فاطمة السلمي" },
  { id: 3,  title: "درس فيديو — الضوء وخصائصه",               subject: "علوم",     grade: "الصف السابع",  type: "video",  questions: 8,  uses: 640,  isNew: false, isFeatured: true,  teacherName: "حصاد" },
  { id: 4,  title: "واجب القرآن الكريم — سورة الكهف",          subject: "دين",      grade: "الصف الثامن",  type: "hw",     questions: 12, uses: 530,  isNew: true,  isFeatured: false, teacherName: "أ. محمد العتيبي" },
  { id: 5,  title: "اختبار العلوم الاجتماعية — الوطن العربي",  subject: "اجتماعيات", grade: "الصف السادس",  type: "quiz",   questions: 18, uses: 420,  isNew: false, isFeatured: true,  teacherName: "حصاد" },
  { id: 6,  title: "مسابقة الأحياء — الخلية ووظائفها",         subject: "أحياء",    grade: "الصف التاسع",  type: "live",   questions: 22, uses: 980,  isNew: true,  isFeatured: false, teacherName: "أ. نورة الدوسري" },
  { id: 7,  title: "واجب الفيزياء — قوانين نيوتن",             subject: "فيزياء",   grade: "الصف العاشر",  type: "hw",     questions: 10, uses: 310,  isNew: false, isFeatured: false, teacherName: "أ. خالد الغامدي" },
  { id: 8,  title: "درس فيديو — نشأة الإسلام وانتشاره",        subject: "دين",      grade: "الصف السادس",  type: "video",  questions: 6,  uses: 760,  isNew: true,  isFeatured: true,  teacherName: "حصاد" },
  { id: 9,  title: "تحدي الكيمياء — الجدول الدوري",            subject: "كيمياء",   grade: "الصف الحادي عشر", type: "live", questions: 25, uses: 1100, isNew: false, isFeatured: true,  teacherName: "أ. سارة الزهراني" },
  { id: 10, title: "قراءة وفهم — قصة الملك والصياد",           subject: "لغة عربية", grade: "الصف الرابع",  type: "hw",     questions: 8,  uses: 450,  isNew: true,  isFeatured: false, teacherName: "أ. عبدالله القحطاني" },
  { id: 11, title: "اختبار التاريخ — الدولة العباسية",         subject: "تاريخ",    grade: "الصف الثامن",  type: "quiz",   questions: 16, uses: 280,  isNew: false, isFeatured: false, teacherName: "أ. منيرة البقمي" },
  { id: 12, title: "مسابقة مباشرة — الضرب والقسمة",            subject: "رياضيات",  grade: "الصف الثالث",  type: "live",   questions: 30, uses: 1560, isNew: true,  isFeatured: true,  teacherName: "حصاد" },
];

const SUBJECT_COLORS: Record<string, { bg: string; text: string; letter: string }> = {
  "رياضيات":   { bg: "linear-gradient(135deg,#1a56db,#3b82f6)", text: "#fff", letter: "ر" },
  "لغة عربية": { bg: "linear-gradient(135deg,#225739,#468064)", text: "#fff", letter: "ع" },
  "علوم":      { bg: "linear-gradient(135deg,#7c3aed,#a855f7)", text: "#fff", letter: "ع" },
  "دين":       { bg: "linear-gradient(135deg,#b45309,#d97706)", text: "#fff", letter: "ق" },
  "اجتماعيات": { bg: "linear-gradient(135deg,#be185d,#ec4899)", text: "#fff", letter: "ا" },
  "أحياء":     { bg: "linear-gradient(135deg,#047857,#10b981)", text: "#fff", letter: "أ" },
  "فيزياء":    { bg: "linear-gradient(135deg,#0e7490,#06b6d4)", text: "#fff", letter: "ف" },
  "كيمياء":    { bg: "linear-gradient(135deg,#9333ea,#c026d3)", text: "#fff", letter: "ك" },
  "تاريخ":     { bg: "linear-gradient(135deg,#92400e,#d97706)", text: "#fff", letter: "ت" },
};

const TYPE_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  quiz:  { label: "اختبار",       color: "#1d4ed8", bg: "#eff6ff", icon: <ClipboardList size={12} /> },
  live:  { label: "مسابقة مباشرة", color: "#065f46", bg: "#ecfdf5", icon: <Zap size={12} />          },
  video: { label: "فيديو",        color: "#7c3aed", bg: "#f5f3ff", icon: <Video size={12} />         },
  hw:    { label: "واجب",         color: "#225739", bg: "#e8f4ec", icon: <BookText size={12} />      },
};

const STATS = [
  { icon: <BookText size={16} />, value: "٢٤٠٠+", label: "نشاط جاهز"       },
  { icon: <Users    size={16} />, value: "١٨٠",   label: "معلم مشارك"      },
  { icon: <TrendingUp size={16}/>, value: "٤٧ ألف", label: "مرة استُخدم"   },
  { icon: <Zap      size={16} />, value: "٣٨",    label: "جديد هذا الأسبوع" },
];

function fmtUses(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}ك`;
  return String(n);
}

function SubjectThumb({ subject, size = 56 }: { subject: string; size?: number }) {
  const theme = SUBJECT_COLORS[subject] ?? { bg: "linear-gradient(135deg,#374151,#6b7280)", text: "#fff", letter: "؟" };
  return (
    <div style={{
      width: size, height: size, borderRadius: 12, flexShrink: 0,
      background: theme.bg, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: size * 0.38, fontWeight: 900, color: theme.text,
      fontFamily: "Tajawal, sans-serif",
    }}>
      {theme.letter}
    </div>
  );
}

function ActivityCard({ a, compact }: { a: typeof MOCK_ACTIVITIES[0]; compact?: boolean }) {
  const [bookmarked, setBookmarked] = useState(false);
  const type = TYPE_META[a.type] ?? TYPE_META.hw;
  const subTheme = SUBJECT_COLORS[a.subject] ?? { bg: "linear-gradient(135deg,#374151,#6b7280)", text: "#fff", letter: "؟" };

  return (
    <div style={{
      background: C.card, borderRadius: 20, border: `1px solid ${C.border}`,
      overflow: "hidden", display: "flex", flexDirection: "column",
      transition: "transform 0.2s, box-shadow 0.2s", cursor: "pointer",
      boxShadow: "0 2px 8px rgba(31,45,36,0.06)",
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 16px 40px rgba(31,45,36,0.13)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = "";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(31,45,36,0.06)";
      }}
    >
      {/* Cover */}
      <div style={{ position: "relative", height: compact ? 80 : 100, background: subTheme.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: compact ? 34 : 44, fontWeight: 900, color: "rgba(255,255,255,0.9)", fontFamily: "Tajawal,sans-serif" }}>
          {subTheme.letter}
        </span>
        {/* Type badge */}
        <span style={{
          position: "absolute", top: 10, right: 10,
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
          color: "#fff", borderRadius: 8, padding: "3px 8px",
          fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 4,
        }}>
          {type.icon} {type.label}
        </span>
        {/* New badge */}
        {a.isNew && (
          <span style={{
            position: "absolute", top: 10, left: 10,
            background: C.gold, color: "#1F2D24", borderRadius: 8,
            padding: "3px 8px", fontSize: 10, fontWeight: 800,
          }}>جديد</span>
        )}
        {/* Bookmark */}
        <button
          onClick={e => { e.stopPropagation(); setBookmarked(b => !b); }}
          style={{
            position: "absolute", bottom: 10, left: 10,
            width: 30, height: 30, borderRadius: 10, border: "none", cursor: "pointer",
            background: "rgba(255,255,255,0.92)", display: "flex", alignItems: "center", justifyContent: "center",
            color: bookmarked ? C.gold : C.muted,
          }}
        >
          <Bookmark size={14} fill={bookmarked ? C.gold : "none"} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: compact ? "12px 14px" : "14px 16px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.text, lineHeight: 1.4,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {a.title}
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, background: C.bg, borderRadius: 6, padding: "2px 7px" }}>
            {a.subject}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, background: C.bg, borderRadius: 6, padding: "2px 7px" }}>
            {a.grade}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, background: C.bg, borderRadius: 6, padding: "2px 7px" }}>
            {a.questions} سؤال
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
          <span style={{ fontSize: 10, color: C.muted, fontWeight: 500 }}>
            {fmtUses(a.uses)} استخدام · {a.teacherName === "حصاد" ? (
              <span style={{ color: C.primary, fontWeight: 700 }}>حصاد ✦</span>
            ) : a.teacherName}
          </span>
        </div>
        {/* Actions */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, display: "flex", gap: 8 }}>
          <button style={{
            flex: 1, background: C.primary, color: "#fff", border: "none",
            borderRadius: 12, padding: "8px 0", fontSize: 12, fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}>
            <Play size={12} fill="#fff" /> ابدأ
          </button>
          <button style={{
            width: 36, height: 36, background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: C.muted,
          }}>
            <Download size={13} />
          </button>
          <button style={{
            width: 36, height: 36, background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: C.muted,
          }}>
            <Copy size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function TrendingCard({ a }: { a: typeof MOCK_ACTIVITIES[0] }) {
  const isActive = a.uses > 900;
  return (
    <div style={{
      background: C.primary, borderRadius: 20, padding: "18px 20px",
      minWidth: 280, maxWidth: 320, flexShrink: 0, cursor: "pointer",
      display: "flex", flexDirection: "column", gap: 12, position: "relative", overflow: "hidden",
      transition: "transform 0.2s, box-shadow 0.2s",
      boxShadow: "0 4px 20px rgba(34,87,57,0.3)",
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 30px rgba(34,87,57,0.4)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = "";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(34,87,57,0.3)";
      }}
    >
      {/* Decorative circle */}
      <div style={{ position: "absolute", top: -30, left: -30, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <SubjectThumb subject={a.subject} size={44} />
          <div>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "rgba(255,255,255,0.15)", borderRadius: 8,
              padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "#fff", marginBottom: 4,
            }}>
              {isActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80", display: "inline-block", animation: "pulse 1.5s infinite" }} />}
              {isActive ? "نشط الآن" : TYPE_META[a.type]?.label ?? "نشاط"}
            </span>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>{a.title}</p>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{fmtUses(a.uses)} استخدام · {a.questions} سؤال</span>
        <button style={{
          background: C.gold, color: C.primary2, border: "none", borderRadius: 10,
          padding: "6px 14px", fontSize: 11, fontWeight: 800, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <Play size={10} fill={C.primary2} /> ابدأ
        </button>
      </div>
    </div>
  );
}

type FilterType = "all" | "quiz" | "live" | "video" | "hw";
type CategoryType = "all" | "featured" | "new" | "popular";

export function Redesign() {
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<FilterType>("all");
  const [activeCategory, setActiveCategory] = useState<CategoryType>("all");
  const [subject, setSubject] = useState("الكل");
  const [view, setView] = useState<"grid" | "list">("grid");

  const filtered = MOCK_ACTIVITIES.filter(a => {
    if (search && !a.title.includes(search) && !a.subject.includes(search)) return false;
    if (activeType !== "all" && a.type !== activeType) return false;
    if (activeCategory === "featured" && !a.isFeatured) return false;
    if (activeCategory === "new" && !a.isNew) return false;
    if (activeCategory === "popular" && a.uses < 600) return false;
    if (subject !== "الكل" && a.subject !== subject) return false;
    return true;
  });

  const trending = [...MOCK_ACTIVITIES].sort((a, b) => b.uses - a.uses).slice(0, 4);
  const featured = MOCK_ACTIVITIES.filter(a => a.isFeatured).slice(0, 4);

  const typeFilters: { id: FilterType; label: string; icon: React.ReactNode }[] = [
    { id: "all",   label: "كل الأنواع",    icon: <Globe size={14} />       },
    { id: "live",  label: "مسابقة مباشرة", icon: <Zap size={14} />         },
    { id: "quiz",  label: "اختبارات",      icon: <ClipboardList size={14} /> },
    { id: "hw",    label: "واجبات",        icon: <BookText size={14} />     },
    { id: "video", label: "فيديو",         icon: <Video size={14} />        },
  ];

  const categoryTabs: { id: CategoryType; label: string }[] = [
    { id: "all",      label: "الكل"          },
    { id: "popular",  label: "الأكثر استخداماً" },
    { id: "new",      label: "جديد هذا الأسبوع" },
    { id: "featured", label: "أنشطة مميزة"   },
  ];

  const subjects = ["الكل", ...Array.from(new Set(MOCK_ACTIVITIES.map(a => a.subject)))];

  return (
    <div dir="rtl" style={{ fontFamily: "Tajawal, sans-serif", background: C.bg, minHeight: "100vh", color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #c8d5cd; border-radius: 4px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .fade-up { animation: fadeUp 0.35s ease both; }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh" }}>

        {/* ════ Sidebar ════ */}
        <aside style={{
          width: 260, flexShrink: 0, background: C.sidebar,
          borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column",
          position: "sticky", top: 0, height: "100vh", overflowY: "auto",
        }}>
          {/* Logo area */}
          <div style={{ padding: "24px 20px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookText size={16} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 900, color: C.text }}>مكتبة الأنشطة</p>
                <p style={{ fontSize: 10, color: C.muted }}>اكتشف وابدأ فوراً</p>
              </div>
            </div>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <Search size={15} style={{ position: "absolute", top: "50%", right: 12, transform: "translateY(-50%)", color: C.muted }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحث عن نشاط..."
                style={{
                  width: "100%", height: 42, paddingRight: 36, paddingLeft: search ? 36 : 12,
                  borderRadius: 14, border: `1.5px solid ${search ? C.primary : C.border}`,
                  background: C.bg, fontSize: 13, fontFamily: "Tajawal,sans-serif",
                  color: C.text, outline: "none", transition: "border-color 0.2s",
                }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ position: "absolute", top: "50%", left: 10, transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted }}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Type filters */}
          <div style={{ padding: "16px 20px" }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>نوع النشاط</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {typeFilters.map(f => (
                <button key={f.id} onClick={() => setActiveType(f.id)} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                  borderRadius: 12, border: "none", cursor: "pointer", textAlign: "right",
                  fontSize: 13, fontWeight: activeType === f.id ? 800 : 600,
                  fontFamily: "Tajawal,sans-serif",
                  background: activeType === f.id ? C.soft : "transparent",
                  color: activeType === f.id ? C.primary : C.muted,
                  transition: "all 0.15s",
                }}>
                  <span style={{ color: activeType === f.id ? C.primary : C.muted }}>{f.icon}</span>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject filter */}
          <div style={{ padding: "0 20px 16px", borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>المادة الدراسية</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {subjects.slice(0, 9).map(s => (
                <button key={s} onClick={() => setSubject(s)} style={{
                  padding: "5px 10px", borderRadius: 8, border: `1px solid ${subject === s ? C.primary : C.border}`,
                  background: subject === s ? C.soft : "transparent",
                  color: subject === s ? C.primary : C.muted,
                  fontSize: 11, fontWeight: subject === s ? 700 : 500,
                  cursor: "pointer", fontFamily: "Tajawal,sans-serif",
                  transition: "all 0.15s",
                }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Share CTA */}
          <div style={{ marginTop: "auto", padding: 20 }}>
            <button style={{
              width: "100%", padding: "12px 0", borderRadius: 14,
              background: `linear-gradient(135deg, ${C.primary}, #1c4630)`,
              color: "#fff", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 800, fontFamily: "Tajawal,sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              boxShadow: "0 4px 16px rgba(34,87,57,0.3)",
            }}>
              <Plus size={15} /> شارك نشاطاً
            </button>
          </div>
        </aside>

        {/* ════ Main Content ════ */}
        <main style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "28px 32px" }}>

          {/* Stats bar */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28,
            background: C.card, borderRadius: 20, padding: "16px 24px",
            border: `1px solid ${C.border}`, boxShadow: "0 2px 8px rgba(31,45,36,0.05)",
          }}>
            {STATS.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: C.soft, display: "flex", alignItems: "center", justifyContent: "center", color: C.primary }}>
                  {s.icon}
                </div>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 900, color: C.text, lineHeight: 1 }}>{s.value}</p>
                  <p style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{s.label}</p>
                </div>
                {i < 3 && <div style={{ width: 1, height: 36, background: C.border, marginRight: "auto" }} />}
              </div>
            ))}
          </div>

          {/* Trending section */}
          <section style={{ marginBottom: 32 }} className="fade-up">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 3, height: 22, background: `linear-gradient(to bottom, ${C.gold}, ${C.primary})`, borderRadius: 2 }} />
                <Radio size={16} color={C.primary} />
                <h2 style={{ fontSize: 18, fontWeight: 900, color: C.text }}>رائج الآن</h2>
              </div>
              <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.primary, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, fontFamily: "Tajawal,sans-serif" }}>
                عرض الكل <ChevronLeft size={14} />
              </button>
            </div>
            <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 4 }}>
              {trending.map(a => <TrendingCard key={a.id} a={a} />)}
            </div>
          </section>

          {/* Category tabs + view toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 4, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 4 }}>
              {categoryTabs.map(t => (
                <button key={t.id} onClick={() => setActiveCategory(t.id)} style={{
                  padding: "7px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: activeCategory === t.id ? 800 : 600,
                  fontFamily: "Tajawal,sans-serif",
                  background: activeCategory === t.id ? C.primary : "transparent",
                  color: activeCategory === t.id ? "#fff" : C.muted,
                  transition: "all 0.2s",
                }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["grid", "list"] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  width: 36, height: 36, borderRadius: 10, border: `1px solid ${view === v ? C.primary : C.border}`,
                  background: view === v ? C.soft : C.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  color: view === v ? C.primary : C.muted, transition: "all 0.15s",
                }}>
                  {v === "grid" ? <LayoutGrid size={15} /> : <List size={15} />}
                </button>
              ))}
            </div>
          </div>

          {/* Results count */}
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 16, fontWeight: 600 }}>
            {filtered.length} نشاط
            {(search || activeType !== "all" || activeCategory !== "all" || subject !== "الكل") && (
              <button onClick={() => { setSearch(""); setActiveType("all"); setActiveCategory("all"); setSubject("الكل"); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.primary, fontWeight: 700, marginRight: 8, fontSize: 12, fontFamily: "Tajawal,sans-serif" }}>
                × مسح الفلاتر
              </button>
            )}
          </p>

          {/* Grid */}
          {view === "grid" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {filtered.map((a, i) => (
                <div key={a.id} className="fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
                  <ActivityCard a={a} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((a, i) => (
                <div key={a.id} className="fade-up" style={{
                  animationDelay: `${i * 0.04}s`,
                  background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
                  display: "flex", alignItems: "center", gap: 16, padding: "14px 20px",
                  transition: "box-shadow 0.2s",
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(31,45,36,0.1)"}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = ""}
                >
                  <SubjectThumb subject={a.subject} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 4 }}>{a.title}</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, color: C.muted, background: C.bg, borderRadius: 6, padding: "2px 7px" }}>{a.subject}</span>
                      <span style={{ fontSize: 10, color: C.muted, background: C.bg, borderRadius: 6, padding: "2px 7px" }}>{a.grade}</span>
                      <span style={{ fontSize: 10, color: C.muted, background: C.bg, borderRadius: 6, padding: "2px 7px" }}>{a.questions} سؤال</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>{fmtUses(a.uses)} استخدام</span>
                    <button style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 10, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "Tajawal,sans-serif" }}>
                      <Play size={11} fill="#fff" /> ابدأ
                    </button>
                    <button style={{ width: 34, height: 34, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
                      <Download size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>🔍</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 6 }}>لا توجد نتائج</p>
              <p style={{ fontSize: 13, color: C.muted }}>جرّب تغيير الفلاتر أو البحث بكلمة مختلفة</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
