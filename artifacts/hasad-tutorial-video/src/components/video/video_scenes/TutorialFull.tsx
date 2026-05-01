/**
 * TutorialFull — full step-by-step walkthrough:
 *   1. Teacher dashboard
 *   2. Click "أنشئ نشاطاً جديداً"
 *   3. Fill basics form
 *   4. AI question generation
 *   5. Publish → see assignment card
 *   6. Click "لعبة مباشرة" → choose وميض
 *   7. Wameed lobby + PIN appears
 *   8. Students join one by one
 *   9. Countdown → game starts
 *  10. Question + live leaderboard
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  Zap, Plus, BookOpen, Users, BarChart2, Trophy, Check,
  Sparkles, Play, ChevronDown, Settings, Send, Bell, X
} from 'lucide-react';

// ─── Cursor component ─────────────────────────────────────────────────────────
function Cursor({ x, y, clicking }: { x: number; y: number; clicking: boolean }) {
  return (
    <motion.div
      className="pointer-events-none absolute z-[100]"
      animate={{ left: `${x}%`, top: `${y}%` }}
      transition={{ type: 'spring', stiffness: 220, damping: 28 }}
      style={{ translateX: '-50%', translateY: '-50%' }}
    >
      <motion.svg
        width="28" height="32" viewBox="0 0 28 32" fill="none"
        animate={{ scale: clicking ? 0.78 : 1 }}
        transition={{ type: 'spring', stiffness: 600, damping: 20 }}
      >
        <path
          d="M5 3L5 23L10.5 18.5L14.5 27L17 26L13 17.5L21 17.5L5 3Z"
          fill="white" stroke="#1a1a1a" strokeWidth="1.5" strokeLinejoin="round"
        />
      </motion.svg>
      {clicking && (
        <motion.div
          className="absolute top-0 left-0 w-8 h-8 rounded-full border-2 border-emerald-400"
          initial={{ scale: 0.4, opacity: 0.9 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 0.45 }}
        />
      )}
    </motion.div>
  );
}

// ─── Step callout ─────────────────────────────────────────────────────────────
function StepBadge({ num, label, visible }: { num: number; label: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900/90 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-xl border border-white/10"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center font-black text-sm shrink-0">
            {num}
          </div>
          <span className="font-bold text-sm">{label}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Highlight ring around clicked element ───────────────────────────────────
function ClickRing({ x, y, visible }: { x: number; y: number; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute z-[90] rounded-xl border-2 border-emerald-400 pointer-events-none"
          style={{
            left: `${x}%`, top: `${y}%`,
            width: 160, height: 44,
            translateX: '-50%', translateY: '-50%',
          }}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 24 }}
        />
      )}
    </AnimatePresence>
  );
}

// ─── Typing hook ──────────────────────────────────────────────────────────────
function useTyping(text: string, start: boolean, speed = 55) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    if (!start) { setShown(''); return; }
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [start, text, speed]);
  return shown;
}

// ─── Phase timing (ms) ───────────────────────────────────────────────────────
const PHASES = {
  DASHBOARD:          400,
  CURSOR_TO_CREATE:   2200,
  CLICK_CREATE:       4000,
  FORM_APPEAR:        4600,
  TYPING_TITLE:       5200,
  PICK_CLASS:         8200,
  PICK_SUBJECT:       9800,
  CURSOR_NEXT:        11500,
  CLICK_NEXT:         12200,
  QUESTIONS_APPEAR:   13000,
  AI_LOADING:         13600,
  AI_DONE:            15800,
  CURSOR_PUBLISH:     17500,
  CLICK_PUBLISH:      18300,
  DASHBOARD_BACK:     19200,
  CURSOR_LIVE:        21000,
  CLICK_LIVE:         22200,
  WAMEED_MENU:        22900,
  CLICK_WAMEED:       24000,
  LOBBY_APPEAR:       24900,
  STUDENTS_JOIN:      26500,
  STUDENT2:           27400,
  STUDENT3:           28300,
  STUDENT4:           29200,
  STUDENT5:           30100,
  CURSOR_START:       31500,
  CLICK_START:        32400,
  COUNTDOWN3:         33200,
  COUNTDOWN2:         34100,
  COUNTDOWN1:         35000,
  GAME_START:         35900,
  QUESTION_APPEAR:    36500,
  CORRECT_ANSWER:     39500,
  SCORE_FLY:          39500,
  LEADERBOARD:        40800,
  EXIT:               46000,
};

// ─── Main scene ───────────────────────────────────────────────────────────────
export function TutorialFull() {
  const [ms, setMs] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setMs(Date.now() - startRef.current);
    }, 40);
    return () => window.clearInterval(id);
  }, []);

  const at = (key: keyof typeof PHASES) => ms >= PHASES[key];
  const between = (a: keyof typeof PHASES, b: keyof typeof PHASES) => at(a) && !at(b);

  // ── Cursor position ────────────────────────────────────────────────────────
  type CursorPos = { x: number; y: number };
  const cursorPos = (): CursorPos => {
    if (at('CLICK_WAMEED'))   return { x: 60, y: 52 };
    if (at('WAMEED_MENU'))    return { x: 60, y: 52 };
    if (at('CLICK_LIVE'))     return { x: 74, y: 74 };
    if (at('CURSOR_LIVE'))    return { x: 74, y: 74 };
    if (at('CLICK_PUBLISH'))  return { x: 50, y: 80 };
    if (at('CURSOR_PUBLISH')) return { x: 50, y: 80 };
    if (at('CLICK_NEXT'))     return { x: 50, y: 76 };
    if (at('CURSOR_NEXT'))    return { x: 50, y: 76 };
    if (at('CLICK_CREATE'))   return { x: 37, y: 44 };
    if (at('CURSOR_TO_CREATE')) return { x: 37, y: 44 };
    return { x: 80, y: 30 };
  };
  const { x: cx, y: cy } = cursorPos();
  const clicking =
    between('CLICK_CREATE', 'FORM_APPEAR') ||
    between('CLICK_NEXT', 'QUESTIONS_APPEAR') ||
    between('CLICK_PUBLISH', 'DASHBOARD_BACK') ||
    between('CLICK_LIVE', 'WAMEED_MENU') ||
    between('CLICK_WAMEED', 'LOBBY_APPEAR') ||
    between('CLICK_START', 'COUNTDOWN3');

  const titleTyped = useTyping('مسابقة الفصل الثالث — علوم الأرض', at('TYPING_TITLE'), 52);

  const students = [
    { name: 'سارة',  color: '#F472B6', phase: 'STUDENTS_JOIN' },
    { name: 'أحمد',  color: '#38BDF8', phase: 'STUDENT2' },
    { name: 'ليلى',  color: '#A78BFA', phase: 'STUDENT3' },
    { name: 'خالد',  color: '#FB923C', phase: 'STUDENT4' },
    { name: 'نور',   color: '#34D399', phase: 'STUDENT5' },
  ] as const;

  const joinedCount = students.filter(s => at(s.phase)).length;

  const countdown = at('COUNTDOWN1') ? 1 : at('COUNTDOWN2') ? 2 : at('COUNTDOWN3') ? 3 : 0;

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden z-10 bg-slate-100"
      initial={{ opacity: 0 }}
      animate={{ opacity: at('EXIT') ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      dir="rtl"
    >
      {/* ── LAYER 1: Teacher Dashboard ─────────────────────────────────────── */}
      <AnimatePresence>
        {between('DASHBOARD', 'FORM_APPEAR') && (
          <motion.div
            key="dashboard"
            className="absolute inset-0 flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.4 }}
          >
            {/* Sidebar */}
            <aside className="w-52 bg-white border-l border-slate-200 flex flex-col py-6 px-3 gap-1 shadow-sm shrink-0">
              <div className="flex items-center gap-2 px-3 mb-6">
                <span className="font-black text-2xl text-emerald-600">حصاد</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              {[
                { icon: BookOpen, label: 'واجباتي', active: true },
                { icon: Users,    label: 'صفوفي وطلابي', active: false },
                { icon: BarChart2,label: 'ملخص الأداء', active: false },
              ].map(({ icon: Icon, label, active }) => (
                <div
                  key={label}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold ${
                    active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </div>
              ))}
            </aside>

            {/* Main */}
            <main className="flex-1 p-8 overflow-hidden">
              {/* Top bar */}
              <div className="flex items-center justify-between mb-7">
                <div>
                  <div className="text-xs text-slate-400 font-bold">مرحباً بعودتك</div>
                  <h1 className="text-2xl font-black text-slate-800">لوحة المعلم</h1>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Bell size={20} className="text-slate-500" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">3</span>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black text-sm">م</div>
                </div>
              </div>

              {/* "Create" button — highlighted when cursor near */}
              <motion.button
                type="button"
                className="mb-7 flex items-center gap-2 bg-emerald-600 text-white font-black px-5 py-3 rounded-xl shadow-lg shadow-emerald-200 text-sm"
                animate={
                  at('CURSOR_TO_CREATE')
                    ? { scale: [1, 1.06, 1], boxShadow: ['0 8px 20px -4px rgba(16,185,129,0.4)', '0 12px 30px -4px rgba(16,185,129,0.7)', '0 8px 20px -4px rgba(16,185,129,0.4)'] }
                    : {}
                }
                transition={{ duration: 0.9, repeat: at('CURSOR_TO_CREATE') && !at('CLICK_CREATE') ? Infinity : 0 }}
              >
                <Plus size={16} /> أنشئ نشاطاً جديداً
              </motion.button>

              {/* Existing assignments */}
              <div className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest">الواجبات الأخيرة</div>
              <div className="space-y-3">
                {[
                  { title: 'أول مسجد في الإسلام', q: 9, sub: 0, cls: 'إسلامية' },
                  { title: 'مشروع الطهارة والنظافة', q: 15, sub: 14, cls: 'إسلامية' },
                ].map(a => (
                  <div key={a.title} className="bg-white rounded-xl p-4 flex items-center justify-between border border-slate-100 shadow-sm">
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{a.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{a.q} سؤال · {a.sub} تسليم · {a.cls}</div>
                    </div>
                    <span className="text-xs px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full font-bold border border-emerald-100">نشط</span>
                  </div>
                ))}
              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LAYER 2: Create-Assignment Form ───────────────────────────────────── */}
      <AnimatePresence>
        {between('FORM_APPEAR', 'DASHBOARD_BACK') && (
          <motion.div
            key="form"
            className="absolute inset-0 bg-slate-50 flex items-center justify-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.45 }}
          >
            <div className="w-[680px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
              {/* Modal header */}
              <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
                <h2 className="font-black text-xl text-slate-800">إنشاء نشاط جديد</h2>
                <button type="button" className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>

              <AnimatePresence mode="wait">
                {/* Step 1: Basics */}
                {!at('QUESTIONS_APPEAR') && (
                  <motion.div
                    key="basics"
                    className="p-8 space-y-5"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  >
                    {/* Title */}
                    <div>
                      <label className="text-sm font-bold text-slate-500 block mb-2">عنوان النشاط</label>
                      <div className="px-4 py-3 rounded-xl border-2 border-emerald-300 bg-white text-slate-800 font-semibold min-h-[48px]">
                        {titleTyped}
                        {at('TYPING_TITLE') && !at('PICK_CLASS') && (
                          <span className="inline-block w-0.5 h-5 bg-emerald-500 align-middle mx-1 animate-pulse" />
                        )}
                      </div>
                    </div>

                    {/* Class & Subject */}
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="text-sm font-bold text-slate-500 block mb-2">الصف</label>
                        <div className="flex flex-wrap gap-2">
                          {['الرابع', 'الخامس', 'السادس'].map((c, i) => (
                            <motion.span
                              key={c}
                              className={`px-3 py-2 rounded-full text-sm font-bold border cursor-pointer ${
                                at('PICK_CLASS') && i === 1
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-slate-600 border-slate-200'
                              }`}
                              animate={at('PICK_CLASS') && i === 1 ? { scale: [1, 1.1, 1] } : {}}
                              transition={{ duration: 0.35 }}
                            >{c}</motion.span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-bold text-slate-500 block mb-2">المادة</label>
                        <div className="flex flex-wrap gap-2">
                          {['رياضيات', 'علوم', 'عربي'].map((s, i) => (
                            <motion.span
                              key={s}
                              className={`px-3 py-2 rounded-full text-sm font-bold border cursor-pointer ${
                                at('PICK_SUBJECT') && i === 1
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-slate-600 border-slate-200'
                              }`}
                              animate={at('PICK_SUBJECT') && i === 1 ? { scale: [1, 1.1, 1] } : {}}
                              transition={{ duration: 0.35 }}
                            >{s}</motion.span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Next button */}
                    <motion.button
                      type="button"
                      className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl text-base mt-3 flex items-center justify-center gap-2"
                      animate={
                        at('CURSOR_NEXT') && !at('CLICK_NEXT')
                          ? { scale: [1, 1.04, 1], boxShadow: ['0 4px 18px -4px rgba(16,185,129,0.5)', '0 8px 28px -4px rgba(16,185,129,0.8)', '0 4px 18px -4px rgba(16,185,129,0.5)'] }
                          : {}
                      }
                      transition={{ duration: 0.9, repeat: at('CURSOR_NEXT') && !at('CLICK_NEXT') ? Infinity : 0 }}
                    >
                      <Settings size={16} /> التالي: الأسئلة
                    </motion.button>
                  </motion.div>
                )}

                {/* Step 2: Questions */}
                {at('QUESTIONS_APPEAR') && !at('DASHBOARD_BACK') && (
                  <motion.div
                    key="questions"
                    className="p-8 space-y-5"
                    initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    {/* AI generate */}
                    <motion.button
                      type="button"
                      className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl font-black text-lg border-2 ${
                        at('AI_DONE')
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : at('AI_LOADING')
                            ? 'bg-gradient-to-l from-amber-400 to-orange-500 text-white border-orange-400'
                            : 'bg-gradient-to-l from-amber-400 to-orange-500 text-white border-orange-400'
                      }`}
                    >
                      <Sparkles size={20} className={at('AI_LOADING') && !at('AI_DONE') ? 'animate-spin' : ''} />
                      {at('AI_DONE') ? '✓ تم توليد ٣ أسئلة بالذكاء الاصطناعي' : at('AI_LOADING') ? 'يتم التوليد...' : 'توليد الأسئلة بالذكاء الاصطناعي'}
                    </motion.button>

                    {/* Generated questions */}
                    <div className="space-y-3">
                      {[
                        'ما عدد طبقات الغلاف الجوي للأرض؟',
                        'أي الكواكب يُعدّ أقرب إلى الشمس؟',
                        'ما اسم القمر الصناعي الطبيعي للأرض؟',
                      ].map((q, i) => (
                        <motion.div
                          key={q}
                          className="border border-emerald-100 rounded-xl p-4 bg-emerald-50/40 flex items-center justify-between"
                          initial={{ x: 30, opacity: 0 }}
                          animate={{ x: at('AI_DONE') ? 0 : 30, opacity: at('AI_DONE') ? 1 : 0 }}
                          transition={{ delay: i * 0.15 }}
                        >
                          <span className="font-semibold text-slate-800 text-sm">س{i + 1}. {q}</span>
                          <Check size={16} className="text-emerald-500 shrink-0" />
                        </motion.div>
                      ))}
                    </div>

                    {/* Publish */}
                    <motion.button
                      type="button"
                      className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl text-base flex items-center justify-center gap-2"
                      animate={
                        at('CURSOR_PUBLISH') && !at('CLICK_PUBLISH')
                          ? { scale: [1, 1.04, 1], boxShadow: ['0 4px 18px -4px rgba(16,185,129,0.5)', '0 8px 28px -4px rgba(16,185,129,0.8)', '0 4px 18px -4px rgba(16,185,129,0.5)'] }
                          : {}
                      }
                      transition={{ duration: 0.9, repeat: at('CURSOR_PUBLISH') && !at('CLICK_PUBLISH') ? Infinity : 0 }}
                    >
                      <Send size={16} /> نشر النشاط
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LAYER 3: Dashboard with new assignment + "لعبة مباشرة" ──────────── */}
      <AnimatePresence>
        {at('DASHBOARD_BACK') && !at('LOBBY_APPEAR') && (
          <motion.div
            key="dashboard2"
            className="absolute inset-0 flex"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
          >
            <aside className="w-52 bg-white border-l border-slate-200 flex flex-col py-6 px-3 gap-1 shadow-sm shrink-0">
              <div className="flex items-center gap-2 px-3 mb-6">
                <span className="font-black text-2xl text-emerald-600">حصاد</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              {[
                { icon: BookOpen, label: 'واجباتي', active: true },
                { icon: Users,    label: 'صفوفي وطلابي', active: false },
                { icon: BarChart2,label: 'ملخص الأداء', active: false },
              ].map(({ icon: Icon, label, active }) => (
                <div key={label} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold ${active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'}`}>
                  <Icon size={16} />{label}
                </div>
              ))}
            </aside>

            <main className="flex-1 p-8">
              <div className="flex items-center justify-between mb-7">
                <h1 className="text-2xl font-black text-slate-800">لوحة المعلم</h1>
                <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black text-sm">م</div>
              </div>

              {/* New assignment card — highlighted */}
              <motion.div
                className="bg-white rounded-xl p-5 mb-4 border-2 border-emerald-300 shadow-lg shadow-emerald-100 relative overflow-hidden"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', damping: 20 }}
              >
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-bl-lg">جديد</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-black text-slate-800">مسابقة الفصل الثالث — علوم الأرض</div>
                    <div className="text-xs text-slate-400 mt-1">٣ أسئلة · علوم · الصف الخامس</div>
                  </div>
                  {/* لعبة مباشرة button */}
                  <div className="relative">
                    <motion.button
                      type="button"
                      className="flex items-center gap-2 bg-emerald-600 text-white font-black px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-emerald-200"
                      animate={
                        at('CURSOR_LIVE') && !at('CLICK_LIVE')
                          ? { scale: [1, 1.07, 1], boxShadow: ['0 6px 20px -4px rgba(16,185,129,0.5)', '0 10px 32px -4px rgba(16,185,129,0.8)', '0 6px 20px -4px rgba(16,185,129,0.5)'] }
                          : {}
                      }
                      transition={{ duration: 0.9, repeat: at('CURSOR_LIVE') && !at('CLICK_LIVE') ? Infinity : 0 }}
                    >
                      <Zap size={15} /> لعبة مباشرة
                    </motion.button>

                    {/* Dropdown menu */}
                    <AnimatePresence>
                      {at('WAMEED_MENU') && !at('LOBBY_APPEAR') && (
                        <motion.div
                          className="absolute left-0 top-full mt-2 w-44 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50"
                          initial={{ opacity: 0, y: -8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                        >
                          <motion.button
                            type="button"
                            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-right ${at('CLICK_WAMEED') ? 'bg-amber-50 text-amber-700' : 'hover:bg-slate-50 text-slate-700'}`}
                            animate={at('CURSOR_LIVE') ? { backgroundColor: '#fffbeb' } : {}}
                          >
                            <Zap size={16} className="text-amber-500" /> وميض
                          </motion.button>
                          <button type="button" className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-right hover:bg-slate-50 text-slate-500 border-t border-slate-50">
                            <span className="font-mono text-xs">{'</>'}</span> اختراق
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>

              {/* Existing assignments */}
              <div className="space-y-3 opacity-50">
                {[
                  { title: 'أول مسجد في الإسلام', q: 9, sub: 0 },
                  { title: 'مشروع الطهارة والنظافة', q: 15, sub: 14 },
                ].map(a => (
                  <div key={a.title} className="bg-white rounded-xl p-4 flex items-center justify-between border border-slate-100">
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{a.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{a.q} سؤال · {a.sub} تسليم</div>
                    </div>
                  </div>
                ))}
              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LAYER 4: Wameed Lobby ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {at('LOBBY_APPEAR') && !at('EXIT') && (
          <motion.div
            key="lobby"
            className="absolute inset-0 flex flex-col items-center justify-center text-white"
            style={{ background: 'radial-gradient(ellipse at 60% 30%, #FDE68A, #F59E0B 45%, #C2410C 100%)' }}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55 }}
          >
            {/* warm blobs */}
            <div className="absolute inset-0 pointer-events-none opacity-30">
              <motion.div className="absolute top-0 left-0 w-[55vw] h-[55vw] bg-amber-300 rounded-full filter blur-[90px]"
                animate={{ x: [0, 50, 0], y: [0, 30, 0] }} transition={{ duration: 8, repeat: Infinity }} />
              <motion.div className="absolute bottom-0 right-0 w-[50vw] h-[50vw] bg-orange-500 rounded-full filter blur-[90px]"
                animate={{ x: [0, -40, 0], y: [0, -50, 0] }} transition={{ duration: 10, repeat: Infinity }} />
            </div>

            <AnimatePresence mode="wait">
              {!at('GAME_START') && (
                <motion.div
                  key="lobby-content"
                  className="relative z-10 flex flex-col items-center"
                  exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="text-sm font-bold uppercase tracking-[0.3em] opacity-80 mb-1">غرفة وميض</div>
                  <div className="text-xl font-black mb-6">ادخل رمز الانضمام من جهازك</div>

                  {/* Big PIN */}
                  <div className="bg-black/30 backdrop-blur-md rounded-3xl border-2 border-white/30 px-14 py-7 mb-8">
                    <div className="flex gap-3 font-mono font-black tracking-widest" style={{ fontSize: '4.5rem', lineHeight: 1 }}>
                      {['7', '4', '3', '2', '8', '1'].map((d, i) => (
                        <motion.span key={i}
                          initial={{ y: 30, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: i * 0.07, type: 'spring', damping: 16 }}
                        >{d}</motion.span>
                      ))}
                    </div>
                  </div>

                  {/* Students joined */}
                  <div className="flex items-center gap-2 mb-5 text-white font-bold">
                    <Users size={18} />
                    <span>انضم {joinedCount} من ٥ طلاب</span>
                  </div>
                  <div className="flex gap-4 mb-8">
                    {students.map((s, i) => (
                      <motion.div key={s.name} className="flex flex-col items-center gap-1"
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: i < joinedCount ? 0 : 30, opacity: i < joinedCount ? 1 : 0 }}
                        transition={{ delay: 0.05, type: 'spring', damping: 16 }}
                      >
                        <div className="w-14 h-14 rounded-full border-2 border-white/80 flex items-center justify-center font-black text-xl shadow-lg"
                          style={{ background: s.color }}>{s.name.charAt(0)}</div>
                        <span className="text-xs font-bold">{s.name}</span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Start button */}
                  <AnimatePresence>
                    {joinedCount >= 3 && !at('CLICK_START') && (
                      <motion.button
                        type="button"
                        className="flex items-center gap-2 bg-white text-amber-600 font-black px-10 py-4 rounded-2xl text-xl shadow-2xl"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={
                          at('CURSOR_START')
                            ? { scale: [1, 1.06, 1], opacity: 1, boxShadow: ['0 12px 40px -8px rgba(0,0,0,0.3)', '0 18px 55px -8px rgba(0,0,0,0.5)', '0 12px 40px -8px rgba(0,0,0,0.3)'] }
                            : { scale: 1, opacity: 1 }
                        }
                        transition={{ duration: 0.9, repeat: at('CURSOR_START') ? Infinity : 0 }}
                      >
                        <Play size={22} fill="currentColor" /> ابدأ اللعبة
                      </motion.button>
                    )}
                  </AnimatePresence>

                  {/* Countdown */}
                  <AnimatePresence mode="wait">
                    {countdown > 0 && (
                      <motion.div key={countdown}
                        className="text-[12vw] font-black italic drop-shadow-[0_0_40px_rgba(255,255,255,0.7)]"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1.15, opacity: 1 }}
                        exit={{ scale: 2.5, opacity: 0 }}
                        transition={{ duration: 0.5 }}
                      >{countdown}</motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* ── Game ── */}
              {at('GAME_START') && (
                <motion.div
                  key="game"
                  className="relative z-10 w-full h-full flex items-stretch p-8 gap-6"
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.45 }}
                >
                  {/* Question panel */}
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <motion.div
                      className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 w-full max-w-xl"
                      initial={{ y: 30, opacity: 0 }}
                      animate={{ y: at('QUESTION_APPEAR') ? 0 : 30, opacity: at('QUESTION_APPEAR') ? 1 : 0 }}
                      transition={{ type: 'spring', damping: 20 }}
                    >
                      <div className="text-center font-black text-3xl mb-7 leading-relaxed">
                        ما عدد طبقات الغلاف الجوي للأرض؟
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {['٤ طبقات', '٥ طبقات', '٦ طبقات', '٧ طبقات'].map((ans, i) => (
                          <motion.div key={i}
                            className={`p-5 rounded-xl text-center text-xl font-bold border-2 ${
                              i === 1 && at('CORRECT_ANSWER') ? 'bg-white text-amber-600 border-white' : 'bg-black/20 border-white/10'
                            }`}
                            animate={i === 1 && at('CORRECT_ANSWER') ? { scale: [1, 1.07, 1] } : {}}
                          >{ans}</motion.div>
                        ))}
                      </div>
                      {/* +100 fly */}
                      <AnimatePresence>
                        {at('SCORE_FLY') && !at('LEADERBOARD') && (
                          <motion.div
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-black text-white z-50 drop-shadow-[0_0_20px_rgba(255,255,255,0.9)]"
                            initial={{ y: 0, scale: 0, opacity: 1 }}
                            animate={{ y: -170, scale: 1.5, opacity: 0 }}
                            transition={{ duration: 1 }}
                          >+100</motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>

                  {/* Leaderboard */}
                  <motion.div
                    className="w-72 bg-black/25 backdrop-blur-md rounded-3xl p-6 border border-white/10 flex flex-col gap-3"
                    initial={{ x: 80, opacity: 0 }}
                    animate={{ x: at('LEADERBOARD') ? 0 : 80, opacity: at('LEADERBOARD') ? 1 : 0 }}
                    transition={{ type: 'spring', damping: 20 }}
                  >
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-1">
                      <Trophy size={18} className="text-amber-300" /> المتصدرون
                    </h3>
                    {[
                      { name: 'سارة', score: 850, rank: 1, color: '#F472B6' },
                      { name: 'أحمد', score: 720, rank: 2, color: '#38BDF8' },
                      { name: 'نور',  score: 580, rank: 3, color: '#34D399' },
                      { name: 'ليلى', score: 430, rank: 4, color: '#A78BFA' },
                      { name: 'خالد', score: 310, rank: 5, color: '#FB923C' },
                    ].map((p, i) => (
                      <motion.div key={p.name}
                        className="relative flex items-center gap-3 bg-black/20 rounded-xl p-3 overflow-hidden"
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                      >
                        <motion.div className="absolute left-0 top-0 bottom-0 bg-white/10"
                          animate={{ width: `${(p.score / 1000) * 100}%` }}
                          transition={{ duration: 1 }}
                        />
                        <span className="font-black text-sm w-5 relative z-10">{p.rank}</span>
                        <div className="w-9 h-9 rounded-full border-2 border-white/50 flex items-center justify-center font-black text-base relative z-10"
                          style={{ background: p.color }}>{p.name.charAt(0)}</div>
                        <span className="flex-1 font-bold text-sm relative z-10">{p.name}</span>
                        <span className="font-mono font-bold text-sm relative z-10">{p.score}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cursor (always on top, hidden during lobby/game) ─────────────────── */}
      {!at('LOBBY_APPEAR') && (
        <Cursor x={cx} y={cy} clicking={clicking} />
      )}

      {/* ── Step badge ──────────────────────────────────────────────────────── */}
      <StepBadge num={1} label="لوحة المعلم — انقر أنشئ نشاطاً"        visible={between('DASHBOARD', 'FORM_APPEAR')} />
      <StepBadge num={2} label="أدخل بيانات النشاط والأسئلة"            visible={between('FORM_APPEAR', 'DASHBOARD_BACK')} />
      <StepBadge num={3} label="اضغط لعبة مباشرة ← وميض"               visible={between('DASHBOARD_BACK', 'LOBBY_APPEAR')} />
      <StepBadge num={4} label="شارك الرمز مع طلابك للانضمام"           visible={between('LOBBY_APPEAR', 'GAME_START')} />
      <StepBadge num={5} label="اللعبة بدأت — سرعة إجابة + ليدربورد"   visible={at('GAME_START') && !at('EXIT')} />
    </motion.div>
  );
}
