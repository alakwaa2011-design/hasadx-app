import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  Terminal,
  Unlock,
  FolderOpen,
  Library,
  Play,
  Users,
  KeyRound,
} from 'lucide-react';

export function Scene4() {
  const [phase, setPhase] = useState(0);
  const [typedText, setTypedText] = useState('');

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),    // /game/hack setup
      setTimeout(() => setPhase(2), 2000),   // press "ابدأ الاختراق"
      setTimeout(() => setPhase(3), 3300),   // lobby with students
      setTimeout(() => setPhase(4), 6000),   // terminal boot
      setTimeout(() => setPhase(5), 7800),   // password entry
      setTimeout(() => setPhase(6), 9800),   // question
      setTimeout(() => setPhase(7), 11800),  // ACCESS GRANTED
      setTimeout(() => setPhase(8), 13500),  // mystery box steal
      setTimeout(() => setPhase(9), 16000),  // cracked
      setTimeout(() => setPhase(10), 17400), // exit
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  // Typing effect for the password — explicit return on every code path
  useEffect(() => {
    if (phase !== 5) return undefined;
    const str = '••••••••';
    let i = 0;
    const interval = window.setInterval(() => {
      i += 1;
      setTypedText(str.slice(0, i));
      if (i >= str.length) window.clearInterval(interval);
    }, 130);
    return () => window.clearInterval(interval);
  }, [phase]);

  return (
    <motion.div
      className="absolute inset-0 bg-black text-emerald-500 font-mono overflow-hidden z-10 flex items-center justify-center p-8"
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{
        opacity: phase >= 10 ? 0 : 1,
        clipPath:
          phase >= 10
            ? 'circle(0% at 50% 50%)'
            : 'circle(150% at 50% 50%)',
      }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7 }}
    >
      {/* Matrix code rain */}
      <div className="absolute inset-0 opacity-10 flex text-xs whitespace-nowrap overflow-hidden pointer-events-none">
        {[...Array(40)].map((_, i) => (
          <motion.div
            key={i}
            className="flex flex-col items-center mx-2"
            initial={{ y: -1000 }}
            animate={{ y: 1000 }}
            transition={{
              duration: 3 + Math.random() * 5,
              repeat: Infinity,
              ease: 'linear',
              delay: Math.random() * 2,
            }}
          >
            {'0101001101010100101010'.split('').map((char, j) => (
              <div key={j}>{char}</div>
            ))}
          </motion.div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {phase >= 1 && phase < 3 && (
          <HackSetup key="setup" pressed={phase >= 2} />
        )}
        {phase === 3 && <HackLobby key="lobby" />}
        {phase >= 4 && phase < 10 && (
          <TerminalGameplay
            key="play"
            phase={phase}
            typedText={typedText}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function HackSetup({ pressed }: { pressed: boolean }) {
  return (
    <motion.div
      className="relative z-10 w-full max-w-3xl bg-[#040d08] border border-emerald-500/40 rounded-2xl p-8 shadow-[0_0_40px_rgba(16,185,129,0.25)]"
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ scale: 1.1, opacity: 0 }}
      transition={{ duration: 0.4 }}
      dir="rtl"
    >
      <div className="flex items-center gap-2 text-xs text-emerald-400/60 mb-1 font-mono">
        <Terminal size={12} /> /game/hack
      </div>
      <h2 className="font-display text-3xl font-black text-emerald-300 mb-1">
        إعداد لعبة الاختراق
      </h2>
      <p className="text-emerald-500/70 text-sm font-display mb-6">
        اختر مصدر الأسئلة لبدء الجلسة
      </p>

      <div className="text-emerald-400 text-xs font-bold tracking-widest mb-3 font-display">
        مصدر الأسئلة
      </div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <SourceCard icon={FolderOpen} title="واجباتي" subtitle="مراجعة الفصل الثالث" selected />
        <SourceCard icon={Library} title="بنك الأسئلة" subtitle="٢٤٠ سؤال جاهز" />
      </div>

      <div className="text-emerald-400 text-xs font-bold tracking-widest mb-3 font-display">
        الإعدادات
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6 font-display text-sm">
        <SettingPill label="عدد اللاعبين" value="8" />
        <SettingPill label="مدة السؤال" value="20 ث" />
        <SettingPill label="الجولات" value="5" />
      </div>

      <motion.button
        type="button"
        className="w-full bg-gradient-to-l from-emerald-500 to-emerald-400 text-black font-black text-lg py-4 rounded-xl flex items-center justify-center gap-3 font-display shadow-[0_0_20px_rgba(16,185,129,0.4)]"
        animate={
          pressed
            ? { scale: [1, 0.94, 1.04, 1] }
            : { boxShadow: ['0 0 20px rgba(16,185,129,0.4)', '0 0 35px rgba(16,185,129,0.7)', '0 0 20px rgba(16,185,129,0.4)'] }
        }
        transition={{ duration: pressed ? 0.5 : 1.4, repeat: pressed ? 0 : Infinity }}
      >
        <Play size={20} fill="black" /> ابدأ الاختراق
      </motion.button>
    </motion.div>
  );
}

function SourceCard({
  icon: Icon,
  title,
  subtitle,
  selected = false,
}: {
  icon: typeof FolderOpen;
  title: string;
  subtitle: string;
  selected?: boolean;
}) {
  return (
    <div
      className={`p-5 rounded-xl border-2 flex items-center gap-4 ${
        selected
          ? 'border-emerald-400 bg-emerald-500/10'
          : 'border-emerald-500/20 bg-black/40'
      }`}
      dir="rtl"
    >
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center ${
          selected ? 'bg-emerald-400 text-black' : 'bg-emerald-500/20 text-emerald-400'
        }`}
      >
        <Icon size={22} />
      </div>
      <div className="flex-1">
        <div className="font-display font-bold text-emerald-100">{title}</div>
        <div className="text-xs text-emerald-400/70 mt-0.5 font-display">
          {subtitle}
        </div>
      </div>
    </div>
  );
}

function SettingPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-emerald-500/30 rounded-lg p-3 text-center bg-black/40">
      <div className="text-[10px] text-emerald-400/60 mb-1">{label}</div>
      <div className="font-mono font-black text-emerald-300 text-lg">
        {value}
      </div>
    </div>
  );
}

function HackLobby() {
  const players = [
    { handle: 'USER_01', pwd: '••••••••', ready: true },
    { handle: 'USER_02', pwd: '••••••', ready: true },
    { handle: 'USER_03', pwd: '••••', ready: false },
  ];
  return (
    <motion.div
      className="relative z-10 w-full max-w-3xl bg-[#040d08] border border-emerald-500/40 rounded-2xl p-8 shadow-[0_0_40px_rgba(16,185,129,0.25)]"
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ scale: 1.05, opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-2 text-xs text-emerald-400/60 mb-3 font-mono">
        <Terminal size={12} /> session://lobby#7A4-2X9
      </div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-3xl font-black text-emerald-300" dir="rtl">
          غرفة الاختراق
        </h2>
        <div className="flex items-center gap-2 text-emerald-400 font-mono">
          <Users size={18} /> 3/8
        </div>
      </div>
      <p className="text-emerald-500/70 text-sm font-display mb-5" dir="rtl">
        ينتظر النظام أن يختار كل لاعب{' '}
        <span className="text-emerald-300">كلمة السر</span> الخاصة به
      </p>

      <div className="space-y-3 mb-6">
        {players.map((p, i) => (
          <motion.div
            key={p.handle}
            className="flex items-center gap-4 bg-black/50 border border-emerald-500/20 rounded-lg p-3"
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.18 }}
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300 font-bold">
              {i + 1}
            </div>
            <div className="font-mono text-emerald-200 flex-1">{p.handle}</div>
            <div className="flex items-center gap-2 text-emerald-400/80 font-mono text-sm">
              <KeyRound size={14} /> {p.pwd}
            </div>
            <div
              className={`text-xs font-bold px-2 py-1 rounded font-display ${
                p.ready
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}
            >
              {p.ready ? 'جاهز' : 'يكتب...'}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="text-center text-emerald-400 font-mono text-sm tracking-widest"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        ▣ INITIATING_HACK_SEQUENCE...
      </motion.div>
    </motion.div>
  );
}

function TerminalGameplay({
  phase,
  typedText,
}: {
  phase: number;
  typedText: string;
}) {
  return (
    <motion.div
      key="play"
      className="w-full max-w-4xl grid grid-cols-3 gap-8 relative z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Main terminal */}
      <motion.div
        className="col-span-2 bg-[#050f0a] border border-emerald-500/50 rounded-lg p-6 shadow-[0_0_30px_rgba(16,185,129,0.2)] relative min-h-[420px]"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="flex items-center gap-2 mb-6 border-b border-emerald-500/30 pb-2">
          <Terminal size={20} />
          <span className="font-bold tracking-widest">HASAD_OS v2.0</span>
        </div>

        <div className="space-y-2 text-lg">
          {phase >= 4 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {'>'} تهيئة النظام...
            </motion.div>
          )}
          {phase >= 4 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {'>'} تحميل الواجب...
            </motion.div>
          )}
          {phase >= 4 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {'>'} جاهز للاختراق
              <span className="animate-pulse">_</span>
            </motion.div>
          )}

          {phase === 5 && (
            <motion.div
              className="mt-8 border border-emerald-500/50 p-4 bg-emerald-900/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="text-sm mb-2">اختر كلمة السر الخاصة بك:</div>
              <div className="text-2xl tracking-widest">
                {typedText}
                <span className="animate-pulse">|</span>
              </div>
            </motion.div>
          )}

          {phase >= 6 && (
            <motion.div
              className="mt-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="text-emerald-300 text-xl mb-4 font-display" dir="rtl">
                ما هي عاصمة اليابان؟
              </div>
              <div
                className="grid grid-cols-2 gap-4 font-display"
                dir="rtl"
              >
                {['سيول', 'طوكيو', 'بكين', 'بانكوك'].map((city, i) => (
                  <div
                    key={i}
                    className={`border p-3 rounded text-center ${
                      i === 1 && phase >= 7
                        ? 'bg-emerald-500 text-black border-emerald-500'
                        : 'border-emerald-500/50'
                    }`}
                  >
                    {city}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {phase >= 7 && phase < 9 && (
            <motion.div
              className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="text-5xl font-black text-center border-4 border-emerald-500 p-8 rounded-xl shadow-[0_0_50px_rgba(16,185,129,0.5)]">
                ACCESS GRANTED
                <br />
                <span className="font-display text-4xl">تم الاختراق</span>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Sidebar */}
      <motion.div
        className="col-span-1 space-y-4"
        initial={{ x: 50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
      >
        <div className="bg-[#050f0a] border border-emerald-500/50 p-4 rounded-lg">
          <h3
            className="font-display font-bold text-xl mb-4 text-right border-b border-emerald-500/30 pb-2"
            dir="rtl"
          >
            الشبكة
          </h3>

          <div className="space-y-4">
            <HackerRow
              name="USER_01 (أنت)"
              progress={phase >= 7 ? 60 : 40}
              isTarget={false}
            />
            <HackerRow
              name="USER_02"
              progress={phase >= 8 ? 20 : 35}
              isTarget={phase >= 8}
            />
            <HackerRow name="USER_03" progress={15} isTarget={false} />
          </div>
        </div>

        {phase >= 8 && phase < 9 && (
          <motion.div
            className="bg-emerald-900/40 border border-emerald-400 p-4 rounded-lg text-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="font-display font-bold text-lg mb-2 text-white">
              صندوق اختراق!
            </div>
            <div className="text-sm">جاري سحب 15% من USER_02</div>
            <motion.div
              className="text-2xl font-bold mt-2"
              animate={{ color: ['#10b981', '#ffffff', '#10b981'] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              DOWNLOADING...
            </motion.div>
          </motion.div>
        )}

        {phase >= 9 && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 2, opacity: 0, rotateY: 180 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                transition={{ type: 'spring', damping: 12 }}
              >
                <Unlock
                  size={100}
                  className="mx-auto mb-6 text-emerald-400 drop-shadow-[0_0_30px_rgba(16,185,129,0.8)]"
                />
              </motion.div>
              <div
                className="text-4xl font-display font-black text-white mb-2"
                dir="rtl"
              >
                تم كسر الحماية!
              </div>
              <div className="text-xl text-emerald-500 font-mono tracking-widest">
                PASSWORD_CRACKED
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

function HackerRow({
  name,
  progress,
  isTarget,
}: {
  name: string;
  progress: number;
  isTarget: boolean;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1 font-mono">
        <span className={isTarget ? 'text-red-500' : ''}>{name}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 bg-emerald-950 rounded-full overflow-hidden border border-emerald-500/30">
        <motion.div
          className={`h-full ${isTarget ? 'bg-red-500' : 'bg-emerald-500'}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1 }}
        />
      </div>
    </div>
  );
}
