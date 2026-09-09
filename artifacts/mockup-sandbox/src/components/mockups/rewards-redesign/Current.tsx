import React, { useMemo, useState } from "react";
import {
  Archive,
  ArrowRight,
  Check,
  Clock,
  History,
  Map,
  Pencil,
  Plus,
  Presentation,
  Search,
  Settings,
  Sparkles,
  Square,
  Target,
  UserRound,
  Volume2,
  Zap,
} from "lucide-react";
import "./_group.css";

const students = [
  { id: 1, name: "سارة أحمد", points: 24, avatar: "س" },
  { id: 2, name: "محمد علي", points: 18, avatar: "م" },
  { id: 3, name: "ليان خالد", points: 17, avatar: "ل" },
  { id: 4, name: "يوسف عمر", points: 15, avatar: "ي" },
  { id: 5, name: "نور حسن", points: 13, avatar: "ن" },
  { id: 6, name: "ريم عبدالله", points: 0, avatar: "ر" },
];

export function Current() {
  const [view, setView] = useState<"students" | "groups">("students");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const shownStudents = useMemo(
    () => students.filter((student) => student.name.includes(query.trim())),
    [query],
  );

  const toggleStudent = (id: number) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((studentId) => studentId !== id) : [...current, id],
    );
  };

  return (
    <main className="rewards-current" dir="rtl">
      <div className="rewards-current__page">
        <header className="rewards-header">
          <div className="rewards-header__glow rewards-header__glow--left" />
          <div className="rewards-header__glow rewards-header__glow--right" />
          <div className="rewards-header__identity">
            <button className="rewards-header__back" type="button" aria-label="الرجوع إلى اختيار الصف">
              <ArrowRight size={18} />
              <span>رجوع</span>
            </button>
            <span className="rewards-header__map"><Map size={24} /></span>
            <div>
              <h1>
                رحلة التحفيز
                <label className="class-picker">
                  <span className="sr-only">اختر الصف</span>
                  <select defaultValue="5B" aria-label="اختر صف لوحة التحفيز">
                    <option>5B</option>
                  </select>
                </label>
              </h1>
              <p>نقاط جميلة تصنع لحظات إنجاز لا تُنسى</p>
            </div>
          </div>
          <div className="rewards-header__tools">
            <button className="live-button" type="button"><Sparkles size={16} />السبورة الحية</button>
            <button type="button" title="كتم الصوت"><Volume2 size={16} /></button>
            <button type="button" title="السجل والملخص"><History size={16} /></button>
            <button className="amber-icon" type="button" title="قواعد التحفيز التلقائي"><Zap size={16} /></button>
            <button type="button" title="إعدادات التحفيز"><Settings size={16} /></button>
          </div>
        </header>

        <section className="weekly-summary" aria-label="ملخص التحفيز الأسبوعي">
          <article><span>نقاط هذا الأسبوع</span><strong>87</strong></article>
          <article><span>طلاب تم تحفيزهم</span><strong>5</strong></article>
          <article><span>بانتظار التحفيز</span><strong>0</strong></article>
          <article><span>الأكثر استخدامًا</span><strong className="weekly-summary__type">تعاون رائع</strong></article>
        </section>

        <section className="goals-panel" aria-labelledby="reward-goals-title">
          <div className="goals-panel__heading">
            <div className="goals-title">
              <span className="goals-title__icon"><Target size={21} /></span>
              <div>
                <h2 id="reward-goals-title">أهداف التقدم</h2>
                <p>حوّل النقاط إلى رحلة تعلم واضحة</p>
              </div>
            </div>
            <div className="goals-actions">
              <button className="outline-button" type="button"><Presentation size={16} />السبورة الحية</button>
              <button className="primary-button" type="button"><Plus size={16} />هدف جديد</button>
            </div>
          </div>

          <article className="goal-card">
            <div className="goal-card__top">
              <div>
                <div className="goal-card__labels">
                  <span className="goal-kind">هدف الصف</span>
                  <span className="goal-time"><Clock size={12} />متبقي 28 يومًا</span>
                </div>
                <h3>إكمال قراءة عشر قصص</h3>
              </div>
              <div className="goal-card__icons">
                <button type="button" aria-label="تعديل الهدف"><Pencil size={16} /></button>
                <button type="button" aria-label="أرشفة الهدف"><Archive size={16} /></button>
              </div>
            </div>
            <div className="goal-card__progress">
              <div className="goal-card__numbers">
                <span><strong>0</strong><small>/ 100 نقطة</small></span>
                <b>0%</b>
              </div>
              <div className="progress-track"><i style={{ width: "0%" }} /></div>
            </div>
          </article>
        </section>

        <section className="student-area">
          <div className="tabs-row">
            <div className="view-tabs">
              <button type="button" className={view === "students" ? "active" : ""} onClick={() => setView("students")}>الطلاب</button>
              <button type="button" className={view === "groups" ? "active" : ""} onClick={() => setView("groups")}>المجموعات</button>
            </div>
            {view === "students" ? (
              <button className="all-chip" type="button">كل الطلاب</button>
            ) : (
              <button className="new-group" type="button"><Plus size={17} />مجموعة جديدة</button>
            )}
          </div>

          {view === "students" && (
            <>
              <div className="search-row">
                <label className="student-search">
                  <Search size={18} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن طالب..." />
                </label>
                <button
                  type="button"
                  className="select-all"
                  onClick={() => setSelected(selected.length === students.length ? [] : students.map(({ id }) => id))}
                >
                  <Square size={18} />{selected.length === students.length ? "إلغاء التحديد" : "تحديد الكل"}
                </button>
              </div>
              <div className="students-grid">
                {shownStudents.map((student) => {
                  const isSelected = selected.includes(student.id);
                  return (
                    <article className={`student-card${isSelected ? " selected" : ""}`} key={student.id}>
                      <button className="student-card__select" type="button" onClick={() => toggleStudent(student.id)} aria-label={`تحديد ${student.name}`}>
                        {isSelected ? <Check size={14} /> : null}
                      </button>
                      <button className="student-card__profile" type="button" aria-label={`فتح ملف ${student.name}`}><UserRound size={13} /></button>
                      <button className="student-card__body" type="button">
                        <span className={`student-avatar student-avatar--${student.id}`}>{student.avatar}</span>
                        <span className="points-badge"><Sparkles size={13} />{student.points} نقطة</span>
                        <strong>{student.name}</strong>
                        {student.points === 0 && <small>لم يُحفّز بعد</small>}
                      </button>
                    </article>
                  );
                })}
              </div>
            </>
          )}
          {view === "groups" && <div className="groups-empty">اختر «مجموعة جديدة» لإنشاء أول مجموعة.</div>}
        </section>
      </div>
    </main>
  );
}
