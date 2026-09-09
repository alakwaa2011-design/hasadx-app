import { useMemo, useState, type CSSProperties } from "react";
import {
  Archive, ArrowRight, Check, ChevronDown, Clock3, History, Pencil,
  Plus, Presentation, Search, Settings, Sparkles, Target, UserRound,
  Volume2, VolumeX, WandSparkles, Zap,
} from "lucide-react";
import "./_group.css";
import "./RewardWorld.css";
import "./RewardWorldExtra.css";
import "./RewardWorldCelebration.css";

const students = [
  { id: 1, name: "سارة أحمد", points: 24, initial: "س", tone: "rose" },
  { id: 2, name: "محمد علي", points: 18, initial: "م", tone: "azure" },
  { id: 3, name: "ليان خالد", points: 17, initial: "ل", tone: "violet" },
  { id: 4, name: "يوسف عمر", points: 15, initial: "ي", tone: "sun" },
  { id: 5, name: "نور حسن", points: 13, initial: "ن", tone: "mint" },
  { id: 6, name: "ريم عبدالله", points: 0, initial: "ر", tone: "pearl" },
];

function RewardEmblemIcon() {
  return (
    <svg className="rw-emblem__mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="m17 9 7-5 7 5-2 6H19l-2-6Z" fill="#FFF3B8" stroke="#7E5818" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m17 9-3 2 3 3m14-5 3 2-3 3" stroke="#FFF8D6" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="24" cy="27" r="12.5" fill="#FFDB68" stroke="#7E5818" strokeWidth="1.8" />
      <circle cx="24" cy="27" r="8.5" fill="#225C4A" stroke="#FFF3B8" strokeWidth="1.5" />
      <path d="m24 19.5 2.3 5.2 5.7.6-4.3 3.7 1.3 5.5-5-2.9-5 2.9 1.3-5.5-4.3-3.7 5.7-.6 2.3-5.2Z" fill="#FFE58C" />
      <circle cx="24" cy="27" r="2" fill="#FFF8D6" />
      <path d="M12 27a12 12 0 0 1 3.5-8.5M36 27a12 12 0 0 0-3.5-8.5" stroke="#FFF4B8" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="10.5" cy="27" r="1.5" fill="#FFF3B8" />
      <circle cx="37.5" cy="27" r="1.5" fill="#FFF3B8" />
    </svg>
  );
}

export function RewardWorldCelebration() {
  const [view, setView] = useState<"students" | "groups">("students");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [muted, setMuted] = useState(false);
  const [notice, setNotice] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const shown = useMemo(() => students.filter((student) => student.name.includes(query.trim())), [query]);
  const announce = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const toggle = (id: number) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const allSelected = shown.length > 0 && shown.every((student) => selected.includes(student.id));

  return (
    <main className="reward-world reward-world--celebration" dir="rtl">
      <div className="rw-pavilion-lights" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <div className="rw-stars rw-stars--one" /><div className="rw-stars rw-stars--two" />
      <section className="rw-shell">
        <header className="rw-hero">
          <div className="rw-hero__arch rw-hero__arch--right" /><div className="rw-hero__arch rw-hero__arch--left" />
          <div className="rw-hero__identity">
            <button data-testid="button-return-class" className="rw-back" onClick={() => announce("العودة إلى اختيار الصف")} type="button"><ArrowRight size={18} /><span>رجوع</span></button>
            <div className="rw-emblem"><RewardEmblemIcon /><i /><i /><i /></div>
            <div><div className="rw-eyebrow">مملكة حصاد التعليمية</div><h1>رحلة التحفيز <label><span className="sr-only">اختر الصف</span><select data-testid="select-class" defaultValue="5B" aria-label="اختر الصف"><option>5B</option><option>5A</option></select><ChevronDown size={13} /></label></h1><p>كل نقطة تفتح بابًا جديدًا للإنجاز</p></div>
          </div>
          <div className="rw-hero__tools">
            <button data-testid="button-live-board" className="rw-live" type="button" onClick={() => announce("السبورة الحية جاهزة للعرض")}><Presentation size={16} />السبورة الحية</button>
            <button data-testid="button-sound" type="button" title={muted ? "تشغيل الصوت" : "كتم الصوت"} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
            <button data-testid="button-history" type="button" title="السجل والملخص" onClick={() => announce("تم فتح سجل الإنجازات")}><History size={17} /></button>
            <button data-testid="button-rules" className="rw-gold-icon" type="button" title="قواعد التحفيز" onClick={() => announce("قواعد التحفيز التلقائي مفعلة")}><Zap size={17} /></button>
            <button data-testid="button-settings" type="button" title="الإعدادات" onClick={() => announce("تم فتح إعدادات التحفيز")}><Settings size={17} /></button>
          </div>
        </header>
        <section className="rw-summary" aria-label="ملخص الأسبوع">
          <article><span className="rw-summary__glyph rw-summary__glyph--gold"><Sparkles size={17} /></span><div><small>نقاط هذا الأسبوع</small><strong data-testid="text-weekly-points">87</strong></div></article>
          <article><span className="rw-summary__glyph rw-summary__glyph--coral"><UserRound size={17} /></span><div><small>طلاب تم تحفيزهم</small><strong data-testid="text-rewarded-students">5</strong></div></article>
          <article><span className="rw-summary__glyph rw-summary__glyph--mint"><Clock3 size={17} /></span><div><small>بانتظار التحفيز</small><strong data-testid="text-pending-rewards">0</strong></div></article>
          <article><span className="rw-summary__glyph rw-summary__glyph--plum"><WandSparkles size={17} /></span><div><small>الأكثر استخدامًا</small><strong className="rw-summary__word">تعاون رائع</strong></div></article>
        </section>
        <section className="rw-goals" aria-labelledby="rw-goal-title">
          <div className="rw-goals__ribbon">بوابة الإنجاز المفتوحة <span>5B</span></div>
          <div className="rw-goals__head"><div className="rw-section-title"><span><Target size={21} /></span><div><h2 id="rw-goal-title">أهداف التقدم</h2><p>رحلة مشتركة، وخطوة تلو الأخرى</p></div></div><div className="rw-goals__actions"><button data-testid="button-goal-board" onClick={() => announce("تم تجهيز الهدف للسبورة الحية")} type="button"><Presentation size={16} />عرض على السبورة</button><button data-testid="button-new-goal" onClick={() => setGoalOpen(!goalOpen)} type="button"><Plus size={17} />هدف جديد</button></div></div>
          {goalOpen && <div className="rw-goal-form"><input data-testid="input-new-goal" placeholder="اسم الهدف القادم..." autoFocus /><button data-testid="button-save-goal" onClick={() => { setGoalOpen(false); announce("تم حفظ الهدف الجديد"); }} type="button">حفظ الهدف</button></div>}
          <article className="rw-goal-card" data-testid="card-active-goal"><div className="rw-goal-card__lantern"><div className="rw-lantern__top" /><Sparkles size={28} /><div className="rw-lantern__base" /></div><div className="rw-goal-card__main"><div className="rw-goal-meta"><span>هدف الصف</span><small><Clock3 size={12} />متبقي 28 يومًا</small></div><h3>إكمال قراءة عشر قصص</h3><div className="rw-progress-label"><span><b>0</b> / 100 نقطة</span><em>0%</em></div><div className="rw-progress"><i /></div></div><div className="rw-goal-card__buttons"><button data-testid="button-edit-goal" onClick={() => announce("يمكنك الآن تعديل الهدف")} type="button" title="تعديل الهدف"><Pencil size={16} /></button><button data-testid="button-archive-goal" onClick={() => announce("تمت أرشفة الهدف")} type="button" title="أرشفة الهدف"><Archive size={16} /></button></div></article>
        </section>
        <section className="rw-roster">
          <div className="rw-roster__top"><div className="rw-tabs"><button data-testid="button-tab-students" className={view === "students" ? "active" : ""} onClick={() => setView("students")} type="button">الطلاب <b>6</b></button><button data-testid="button-tab-groups" className={view === "groups" ? "active" : ""} onClick={() => setView("groups")} type="button">المجموعات <b>0</b></button></div>{view === "students" ? <button data-testid="button-filter-all" className="rw-filter" onClick={() => setQuery("")} type="button">كل الطلاب <ChevronDown size={15} /></button> : <button data-testid="button-new-group" className="rw-new-group" onClick={() => announce("ابدأ بإضافة أعضاء لمجموعتك")} type="button"><Plus size={17} />مجموعة جديدة</button>}</div>
          {view === "students" ? <><div className="rw-searchline"><label><Search size={18} /><input data-testid="input-search-students" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن طالب في الرحلة..." /></label><button data-testid="button-select-all" onClick={() => setSelected(allSelected ? [] : shown.map((student) => student.id))} type="button">{allSelected ? <Check size={17} /> : <span className="rw-check-empty" />}{allSelected ? "إلغاء التحديد" : "تحديد الكل"}</button></div><div className="rw-students">{shown.map((student, index) => { const isSelected = selected.includes(student.id); return <article className={`rw-student rw-student--${student.tone}${isSelected ? " selected" : ""}`} style={{ "--delay": `${index * 70}ms` } as CSSProperties} key={student.id} data-testid={`card-student-${student.id}`}><div className="rw-student__sky"><span /><span /><span /></div><div className="rw-student__crest"><i /><i /><i /></div><button data-testid={`button-select-student-${student.id}`} className="rw-student__select" onClick={() => toggle(student.id)} type="button" aria-label={`تحديد ${student.name}`}>{isSelected && <Check size={15} />}</button><button data-testid={`button-profile-student-${student.id}`} className="rw-student__profile" onClick={() => announce(`ملف ${student.name}`)} type="button" aria-label={`ملف ${student.name}`}><UserRound size={15} /></button><button data-testid={`button-reward-student-${student.id}`} className="rw-student__body" onClick={() => announce(`أحسنت يا ${student.name.split(" ")[0]}!`)} type="button"><span className="rw-avatar"><i className="rw-avatar__crown" />{student.initial}</span><span className="rw-points"><Sparkles size={13} />{student.points} نقطة</span><strong>{student.name}</strong>{student.points === 0 ? <small>بانتظار أول نجمة</small> : <small>في طريقه إلى البوابة</small>}</button></article>; })}</div></> : <div className="rw-groups-empty"><div><UserRound size={30} /></div><h3>هنا تبدأ فرق الأبطال</h3><p>أنشئ مجموعة لتجعل الإنجاز مغامرة مشتركة.</p><button data-testid="button-create-first-group" onClick={() => announce("تم فتح إعداد مجموعة جديدة")} type="button"><Plus size={16} />إنشاء مجموعة</button></div>}
        </section>
      </section>
      {notice && <div className="rw-toast" role="status" data-testid="status-action">{notice}</div>}
    </main>
  );
}

export default RewardWorldCelebration;