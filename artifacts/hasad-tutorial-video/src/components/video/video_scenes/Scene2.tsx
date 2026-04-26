import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  Check,
  Settings,
  FileText,
  Send,
  Sparkles,
  ChevronDown,
  KeyRound,
  Zap,
  Terminal,
} from 'lucide-react';

const STEPS: { num: number; label: string; icon: typeof Settings }[] = [
  { num: 1, label: 'الأساسيات', icon: Settings },
  { num: 2, label: 'الأسئلة', icon: FileText },
  { num: 3, label: 'النشر', icon: Send },
];

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),    // Stepper appears
      setTimeout(() => setPhase(2), 1500),   // Step 1: Basics
      setTimeout(() => setPhase(3), 5500),   // Step 2: Questions + AI
      setTimeout(() => setPhase(4), 10500),  // Step 3: Publish + advanced + 6-digit code
      setTimeout(() => setPhase(5), 14500),  // Dashboard reveal with two game buttons
      setTimeout(() => setPhase(6), 17000),  // Exit
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const activeStep = phase >= 4 ? 3 : phase >= 3 ? 2 : phase >= 2 ? 1 : 0;

  return (
    <motion.div
      className="absolute inset-0 bg-slate-50 text-slate-900 overflow-hidden z-10 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: phase >= 6 ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Soft gradient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-amber-50/40" />

      {/* Top stepper */}
      <motion.div
        className="relative z-10 flex items-center justify-center gap-6 pt-16 pb-6"
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: phase >= 1 ? 0 : -40, opacity: phase >= 1 ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      >
        {STEPS.map((step, idx) => {
          const done = activeStep > step.num;
          const active = activeStep === step.num;
          const StepIcon = step.icon;
          return (
            <div key={step.num} className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <motion.div
                  className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl border-2 ${
                    done
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : active
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200'
                        : 'bg-white text-slate-400 border-slate-200'
                  }`}
                  animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={{ duration: 0.7 }}
                >
                  {done ? <Check size={26} /> : <StepIcon size={22} />}
                </motion.div>
                <span
                  className={`text-sm font-bold ${
                    active || done ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-emerald-500"
                    initial={{ width: '0%' }}
                    animate={{ width: activeStep > step.num ? '100%' : '0%' }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </motion.div>

      {/* Card stage */}
      <div className="relative z-10 flex-1 flex items-center justify-center pb-16">
        <AnimatePresence mode="wait">
          {phase === 2 && <BasicsCard key="basics" />}
          {phase === 3 && <QuestionsCard key="questions" />}
          {phase === 4 && <PublishCard key="publish" />}
          {phase >= 5 && <DashboardCard key="dashboard" />}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function BasicsCard() {
  return (
    <motion.div
      className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-10 w-[680px]"
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h3 className="text-2xl font-black text-emerald-700 mb-6">
        أساسيات الواجب
      </h3>
      <div className="space-y-5">
        <Field label="عنوان الواجب">
          <TypingValue text="مراجعة الفصل الثالث" speed={55} />
        </Field>
        <div className="grid grid-cols-2 gap-5">
          <Field label="المادة">
            <ChipPicker chips={['رياضيات', 'علوم', 'لغة عربية']} pickIndex={0} />
          </Field>
          <Field label="الصف">
            <ChipPicker chips={['الخامس', 'السادس', 'الأول متوسط']} pickIndex={1} />
          </Field>
        </div>
        <Field label="تاريخ التسليم">
          <div className="px-4 py-3 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 text-slate-700 font-semibold">
            الأحد ١٠ شعبان ١٤٤٧هـ
          </div>
        </Field>
      </div>
    </motion.div>
  );
}

function QuestionsCard() {
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'done'>('idle');
  useEffect(() => {
    const t1 = setTimeout(() => setAiState('loading'), 800);
    const t2 = setTimeout(() => setAiState('done'), 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const generated = [
    { q: 'كم عدد الكواكب في المجموعة الشمسية؟', correct: 'ثمانية' },
    { q: 'ما هو أكبر كوكب؟', correct: 'المشتري' },
    { q: 'أي كوكب يُعرف بالكوكب الأحمر؟', correct: 'المريخ' },
  ];

  return (
    <motion.div
      className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-10 w-[760px]"
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-black text-emerald-700">الأسئلة</h3>
        <div className="flex gap-2 text-sm">
          {['اختيار من متعدد', 'صح أو خطأ', 'إجابة قصيرة'].map((t, i) => (
            <span
              key={t}
              className={`px-3 py-1.5 rounded-full font-bold ${
                i === 0
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* AI Generate button */}
      <motion.button
        type="button"
        className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl font-black text-lg border-2 transition-colors ${
          aiState === 'done'
            ? 'bg-emerald-500 text-white border-emerald-500'
            : 'bg-gradient-to-l from-amber-400 to-orange-500 text-white border-orange-400'
        }`}
        animate={
          aiState === 'loading'
            ? { scale: [1, 1.02, 1] }
            : aiState === 'done'
              ? { scale: 1 }
              : { scale: 1 }
        }
        transition={{ duration: 0.6, repeat: aiState === 'loading' ? Infinity : 0 }}
      >
        <Sparkles
          size={22}
          className={aiState === 'loading' ? 'animate-spin' : ''}
        />
        {aiState === 'idle' && 'توليد الأسئلة بالذكاء الاصطناعي'}
        {aiState === 'loading' && 'يجري توليد الأسئلة...'}
        {aiState === 'done' && 'تم توليد ٣ أسئلة بنجاح'}
      </motion.button>

      {/* Generated questions */}
      <div className="mt-6 space-y-3">
        {generated.map((q, i) => (
          <motion.div
            key={q.q}
            className="border border-emerald-100 rounded-xl p-4 bg-emerald-50/40"
            initial={{ x: 30, opacity: 0 }}
            animate={{
              x: aiState === 'done' ? 0 : 30,
              opacity: aiState === 'done' ? 1 : 0,
            }}
            transition={{ delay: i * 0.18 }}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">
                س{i + 1}. {q.q}
              </span>
              <span className="flex items-center gap-1 text-emerald-600 text-sm font-bold">
                <Check size={16} /> {q.correct}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function PublishCard() {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [codeRevealed, setCodeRevealed] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setAdvancedOpen(true), 700);
    const t2 = setTimeout(() => setCodeRevealed(true), 1700);
    const t3 = setTimeout(() => setPressed(true), 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const code = ['7', '4', '3', '2', '8', '1'];

  return (
    <motion.div
      className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-10 w-[680px]"
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h3 className="text-2xl font-black text-emerald-700 mb-6">
        مراجعة ونشر
      </h3>

      <div className="space-y-3 text-slate-700 mb-5">
        <SummaryRow label="اسم الواجب" value="مراجعة الفصل الثالث" />
        <SummaryRow label="عدد الأسئلة" value="٣ أسئلة" />
        <SummaryRow label="الصف المستهدف" value="السادس · رياضيات" />
      </div>

      {/* Advanced settings collapsible */}
      <button
        type="button"
        className="w-full flex items-center justify-between text-emerald-700 font-bold py-3 border-t border-slate-100"
      >
        <span className="flex items-center gap-2">
          <Settings size={18} /> الإعدادات المتقدمة
        </span>
        <motion.span
          animate={{ rotate: advancedOpen ? 180 : 0 }}
          transition={{ duration: 0.4 }}
        >
          <ChevronDown size={20} />
        </motion.span>
      </button>

      <AnimatePresence>
        {advancedOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="overflow-hidden"
          >
            <div className="pt-4 pb-2 space-y-4">
              <div className="flex items-center gap-3 text-slate-600 text-sm">
                <Check size={16} className="text-emerald-500" /> يُسمح بمحاولة واحدة فقط
              </div>
              <div className="flex items-center gap-3 text-slate-600 text-sm">
                <Check size={16} className="text-emerald-500" /> ترتيب الأسئلة عشوائي
              </div>

              {/* 6-digit access code reveal */}
              <div className="bg-gradient-to-l from-emerald-50 to-amber-50 border-2 border-dashed border-emerald-300 rounded-xl p-4 mt-3">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-3">
                  <KeyRound size={16} /> رمز الدخول للطلاب
                </div>
                <div className="flex justify-center gap-2 font-mono">
                  {code.map((d, i) => (
                    <motion.div
                      key={i}
                      className="w-10 h-12 rounded-lg bg-white border-2 border-emerald-400 flex items-center justify-center text-2xl font-black text-emerald-700"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={
                        codeRevealed
                          ? { scale: 1, opacity: 1 }
                          : { scale: 0, opacity: 0 }
                      }
                      transition={{ delay: i * 0.07, type: 'spring', damping: 12 }}
                    >
                      {d}
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Publish button */}
      <motion.button
        type="button"
        className="mt-5 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg py-4 rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-3"
        animate={pressed ? { scale: [1, 0.95, 1.02, 1] } : { scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Send size={20} /> نشر الواجب
      </motion.button>

      {/* success burst */}
      <AnimatePresence>
        {pressed && (
          <motion.div
            className="absolute inset-0 pointer-events-none flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {[...Array(14)].map((_, i) => (
              <motion.span
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  background: i % 2 ? '#10B981' : '#F59E0B',
                }}
                initial={{ x: 0, y: 0, scale: 0 }}
                animate={{
                  x: Math.cos((i / 14) * Math.PI * 2) * 220,
                  y: Math.sin((i / 14) * Math.PI * 2) * 180,
                  scale: [0, 1, 0],
                  opacity: [1, 1, 0],
                }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DashboardCard() {
  return (
    <motion.div
      className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 w-[760px]"
      initial={{ y: 30, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xl font-black text-slate-800">
          لوحة المعلم · الواجبات
        </h3>
        <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold">
          منشور للتو
        </span>
      </div>
      <div className="border border-slate-200 rounded-xl p-5 mb-5">
        <div className="font-bold text-lg text-slate-800">
          مراجعة الفصل الثالث
        </div>
        <div className="text-sm text-slate-500 mt-1">
          ٣ أسئلة · رياضيات · الصف السادس
        </div>
      </div>
      <div className="text-sm text-slate-500 mb-3 font-bold">
        شغّل الواجب كلعبة:
      </div>
      <div className="grid grid-cols-2 gap-4">
        <motion.button
          type="button"
          className="bg-gradient-to-l from-amber-400 to-orange-500 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-200/60"
          animate={{ boxShadow: ['0 10px 30px -10px rgba(251,146,60,0.6)', '0 14px 40px -10px rgba(251,146,60,0.9)', '0 10px 30px -10px rgba(251,146,60,0.6)'] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          <Zap size={20} /> وميض
        </motion.button>
        <motion.button
          type="button"
          className="bg-slate-900 text-emerald-400 font-mono font-black py-4 rounded-xl flex items-center justify-center gap-2 border border-emerald-500/40"
          animate={{ borderColor: ['rgba(16,185,129,0.4)', 'rgba(16,185,129,1)', 'rgba(16,185,129,0.4)'] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          <Terminal size={20} /> اختراق
        </motion.button>
      </div>
    </motion.div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-sm font-bold text-slate-500 mb-2">{label}</div>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
      <span className="text-slate-500 text-sm">{label}</span>
      <span className="font-bold text-slate-800">{value}</span>
    </div>
  );
}

function ChipPicker({
  chips,
  pickIndex,
}: {
  chips: string[];
  pickIndex: number;
}) {
  const [picked, setPicked] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPicked(true), 700);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c, i) => (
        <motion.span
          key={c}
          className={`px-3 py-2 rounded-full text-sm font-bold border ${
            picked && i === pickIndex
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-slate-600 border-slate-200'
          }`}
          animate={picked && i === pickIndex ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          {c}
        </motion.span>
      ))}
    </div>
  );
}

function TypingValue({ text, speed = 70 }: { text: string; speed?: number }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed]);
  return (
    <div className="px-4 py-3 rounded-xl border-2 border-emerald-300 bg-white text-slate-800 font-semibold">
      {shown}
      <span className="inline-block w-0.5 h-5 bg-emerald-500 align-middle animate-pulse mx-1" />
    </div>
  );
}
