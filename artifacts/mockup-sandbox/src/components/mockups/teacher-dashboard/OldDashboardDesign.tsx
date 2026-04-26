import { useState } from "react";

const GROUPS = ["الكل", "الصف الرابع", "الصف الخامس", "بدون مجموعة"];

const ASSIGNMENTS = [
  { id: 1, title: "العمرة", subject: "إسلامية", questions: 16, submissions: 0, group: "الصف الرابع" },
  { id: 2, title: "ألغاز متنوعة 2", subject: "ألغاز", questions: 12, submissions: 0, group: "بدون مجموعة" },
  { id: 3, title: "ألغاز مستوى 1", subject: "ألغاز", questions: 15, submissions: 0, group: "الصف الخامس" },
  { id: 4, title: "فقه الزكاة", subject: "إسلامية", questions: 15, submissions: 1, group: "الصف الرابع" },
];

const GAMES = [
  { title: "من سيحصد المليون؟", desc: "15 سؤالاً متدرجاً", tag: "شائع" },
  { title: "مَراقي", desc: "مراحل متدرجة الصعوبة" },
  { title: "وميض", desc: "لعبة جماعية سريعة" },
  { title: "شد الحبل", desc: "فريقان يتنافسان" },
  { title: "لعبة الألوان", desc: "ابحث عن المربع المختلف" },
  { title: "فيديو تفاعلي", desc: "درس فيديو بأسئلة" },
];

const TOOLS = [
  { title: "منشئ الواجبات بالذكاء الاصطناعي", desc: "أنشئ واجبات ذكية في ثوانٍ" },
  { title: "إدارة الطلاب", desc: "عرض وإضافة الطلاب" },
  { title: "بنك الأسئلة", desc: "مكتبة أسئلتك الخاصة" },
  { title: "المحتوى المشترك", desc: "تصفح واجبات المعلمين" },
];

function Divider() {
  return <div className="border-t border-gray-100" />;
}

function Section({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-right hover:bg-gray-50/60 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="font-semibold text-gray-800 text-sm">{title}</span>
          {count !== undefined && (
            <span className="text-[11px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <Divider />
          <div className="px-5 py-4">{children}</div>
        </>
      )}
    </div>
  );
}

function AssignmentRow({ a }: { a: typeof ASSIGNMENTS[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border transition-all duration-150 ${open ? "border-gray-200 bg-gray-50/50" : "border-gray-100 hover:border-gray-200"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-right"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-800">{a.title}</span>
            <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">{a.subject}</span>
            {a.group !== "بدون مجموعة" && (
              <span className="text-[11px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md">{a.group}</span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">{a.questions} سؤال · {a.submissions} تسليم</p>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <Divider />
          <div className="px-4 py-3 flex flex-wrap gap-2">
            <button className="text-xs font-medium px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors">
              لعبة مباشرة
            </button>
            <button className="text-xs font-medium px-3 py-1.5 bg-white text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
              تعديل
            </button>
            <button className="text-xs font-medium px-3 py-1.5 bg-white text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
              النتائج
            </button>
            <button className="text-xs font-medium px-3 py-1.5 bg-white text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
              مشاركة
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function OldDashboardDesign() {
  const [activeGroup, setActiveGroup] = useState("الكل");
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = ASSIGNMENTS.filter(
    (a) =>
      (activeGroup === "الكل" || a.group === activeGroup) &&
      (!searchQuery || a.title.includes(searchQuery) || a.subject.includes(searchQuery))
  );

  return (
    <div className="min-h-screen bg-[#f8f8f6] font-sans text-gray-800" dir="rtl">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-5 h-13 flex items-center justify-between gap-4" style={{ height: 52 }}>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
              <span className="text-white font-black text-xs">ح</span>
            </div>
            <span className="font-bold text-gray-900 text-sm tracking-tight">حصاد</span>
          </div>

          <div className="flex-1 max-w-[220px]">
            <div className="relative">
              <input
                type="text"
                placeholder="بحث..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs pr-7 focus:outline-none focus:border-gray-300 focus:bg-white transition-colors placeholder:text-gray-400"
              />
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-50 transition-colors relative"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-400 rounded-full" />
              </button>
              {notifOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white border border-gray-100 rounded-2xl shadow-lg p-3 z-30">
                  <p className="font-semibold text-xs text-gray-700 mb-2 px-1">الإشعارات</p>
                  <div className="space-y-1">
                    <div className="text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">
                      تسليم جديد على واجب <span className="font-semibold">فقه الزكاة</span>
                    </div>
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                      انضم طالب جديد لمجموعتك
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button className="w-8 h-8 rounded-xl bg-gray-900 text-white font-bold text-xs flex items-center justify-center">
              م
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-7 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-snug">أهلاً أستاذ Marwan</h1>
            <p className="text-xs text-gray-400 mt-0.5">الأربعاء، 15 أبريل 2026</p>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            نشط
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5">
          <button className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-xl hover:bg-gray-800 transition-colors">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            واجب جديد
          </button>
          {["لعبة مباشرة", "فيديو تفاعلي", "الطلاب"].map((label) => (
            <button
              key={label}
              className="flex-shrink-0 px-4 py-2 bg-white text-gray-600 text-xs font-medium rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "واجبات", value: "33" },
            { label: "تسليمات", value: "70" },
            { label: "طلاب", value: "24" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-100 rounded-2xl px-4 py-3.5 text-center">
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <Section title="الواجبات والمسابقات" count={ASSIGNMENTS.length} defaultOpen>
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
            {GROUPS.map((g) => (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  activeGroup === g
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="space-y-2 mb-5">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-5">لا توجد واجبات هنا</p>
            ) : (
              filtered.map((a) => <AssignmentRow key={a.id} a={a} />)
            )}
            <button className="w-full py-2.5 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors">
              + إضافة واجب
            </button>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 mb-3">الألعاب والمسابقات</p>
            <div className="grid grid-cols-2 gap-2">
              {GAMES.map((game, i) => (
                <button
                  key={i}
                  className="flex items-start gap-2.5 p-3 bg-gray-50 border border-gray-100 rounded-xl hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all text-right"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-medium text-gray-800 leading-tight">{game.title}</p>
                      {game.tag && (
                        <span className="text-[9px] font-semibold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-md">{game.tag}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{game.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="الإحصاءات">
          <div className="mb-4">
            <p className="text-[11px] text-gray-500 mb-2.5">نشاط التسليمات — آخر 7 أيام</p>
            <div className="flex items-end gap-1.5 h-14">
              {[3, 7, 2, 9, 4, 6, 5].map((v, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gray-200 rounded-md hover:bg-gray-900 transition-colors cursor-pointer"
                  style={{ height: `${(v / 10) * 100}%`, minHeight: 4 }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1.5">
              {["سبت", "أحد", "اثن", "ثلا", "أرب", "خمي", "جمع"].map((d) => (
                <span key={d} className="text-[10px] text-gray-400 flex-1 text-center">{d}</span>
              ))}
            </div>
          </div>

          <Divider />
          <div className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-gray-500">أكثر الطلاب نشاطاً</p>
              <button className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors">عرض الكل</button>
            </div>
            <div className="space-y-2.5">
              {[
                { name: "أحمد الشمري", score: 95, initial: "أ" },
                { name: "فاطمة العمري", score: 88, initial: "ف" },
                { name: "خالد المطيري", score: 76, initial: "خ" },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="text-[10px] text-gray-300 w-4 text-center">{i + 1}</span>
                  <div className="w-6 h-6 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {s.initial}
                  </div>
                  <span className="text-xs text-gray-700 flex-1">{s.name}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gray-400 rounded-full" style={{ width: `${s.score}%` }} />
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium">{s.score}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="أدوات المعلم">
          <div className="space-y-1.5">
            {TOOLS.map((tool, i) => (
              <button
                key={i}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-transparent hover:bg-white hover:border-gray-200 hover:shadow-sm rounded-xl transition-all text-right"
              >
                <div>
                  <p className="text-xs font-medium text-gray-800">{tool.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{tool.desc}</p>
                </div>
                <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ))}
          </div>
        </Section>

        <div className="h-6" />
      </main>
    </div>
  );
}
