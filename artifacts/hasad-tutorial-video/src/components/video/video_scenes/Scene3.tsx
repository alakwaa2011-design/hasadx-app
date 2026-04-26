import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Zap, Snowflake, Shield, Repeat, Trophy, Users, Play } from 'lucide-react';

const STUDENTS = [
  { name: 'سارة', color: '#F472B6' },
  { name: 'أحمد', color: '#38BDF8' },
  { name: 'ليلى', color: '#A78BFA' },
  { name: 'خالد', color: '#FB923C' },
  { name: 'نور', color: '#34D399' },
];

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),    // Dashboard with games tab
      setTimeout(() => setPhase(2), 2200),   // Click "ابدأ الآن" on Wameed card
      setTimeout(() => setPhase(3), 3300),   // Lobby reveal with PIN
      setTimeout(() => setPhase(4), 4500),   // Students join lobby
      setTimeout(() => setPhase(5), 6000),   // Countdown 3
      setTimeout(() => setPhase(6), 6700),   // Countdown 2
      setTimeout(() => setPhase(7), 7400),   // Countdown 1
      setTimeout(() => setPhase(8), 8100),   // ابدأ
      setTimeout(() => setPhase(9), 9000),   // Question + leaderboard
      setTimeout(() => setPhase(10), 11500), // Correct + +100 fly
      setTimeout(() => setPhase(11), 13000), // Power-ups
      setTimeout(() => setPhase(12), 15500), // Overtake + أحسنت
      setTimeout(() => setPhase(13), 17000), // Exit
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden z-10"
      style={{
        background:
          'radial-gradient(ellipse at top right, #FDE68A, #F59E0B 40%, #C2410C 100%)',
      }}
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{
        opacity: phase >= 13 ? 0 : 1,
        scale: phase >= 13 ? 0.95 : 1,
      }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* warm motion blobs */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <motion.div
          className="absolute top-0 left-0 w-[60vw] h-[60vw] bg-amber-300 rounded-full mix-blend-screen filter blur-[100px]"
          animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
          transition={{ duration: 9, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-0 right-0 w-[55vw] h-[55vw] bg-orange-500 rounded-full mix-blend-screen filter blur-[100px]"
          animate={{ x: [0, -50, 0], y: [0, -60, 0] }}
          transition={{ duration: 11, repeat: Infinity }}
        />
      </div>

      <AnimatePresence mode="wait">
        {phase >= 1 && phase < 3 && <DashboardLaunch key="dashboard" launchPressed={phase >= 2} />}
        {phase >= 3 && phase <= 8 && (
          <LobbyView
            key="lobby"
            studentsJoined={phase >= 4 ? Math.min(STUDENTS.length, phase >= 4 ? 5 : 0) : 0}
            countdown={phase >= 5 ? (phase >= 8 ? 0 : phase >= 7 ? 1 : phase >= 6 ? 2 : 3) : -1}
            showStart={phase === 8}
          />
        )}
        {phase >= 9 && phase < 13 && (
          <Gameplay key="play" phase={phase} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DashboardLaunch({ launchPressed }: { launchPressed: boolean }) {
  return (
    <motion.div
      key="dash"
      className="relative z-10 w-full h-full flex items-center justify-center p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="bg-white rounded-2xl shadow-2xl p-7 w-[760px] text-slate-900">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 mb-6">
          {[
            { label: 'الواجبات', active: false },
            { label: 'الألعاب التعليمية', active: true },
            { label: 'التقارير', active: false },
          ].map((tab) => (
            <div
              key={tab.label}
              className={`px-5 py-3 font-bold text-sm relative ${
                tab.active
                  ? 'text-amber-600'
                  : 'text-slate-400'
              }`}
            >
              {tab.label}
              {tab.active && (
                <motion.div
                  className="absolute bottom-[-2px] left-0 right-0 h-1 rounded-t-full bg-gradient-to-l from-amber-400 to-orange-500"
                  layoutId="dashtab"
                />
              )}
            </div>
          ))}
        </div>

        {/* Wameed launch card */}
        <div className="bg-gradient-to-l from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white">
            <Zap size={32} />
          </div>
          <div className="flex-1">
            <div className="font-black text-xl text-slate-900">
              لعبة وميض · مراجعة الفصل الثالث
            </div>
            <div className="text-sm text-slate-500 mt-1">
              ٣ أسئلة · سرعة إجابة · مكافآت آنية
            </div>
          </div>
          <motion.button
            type="button"
            className="bg-gradient-to-l from-amber-400 to-orange-500 text-white font-black px-6 py-4 rounded-xl shadow-lg shadow-orange-300/50 flex items-center gap-2"
            animate={
              launchPressed
                ? { scale: [1, 0.93, 1.08, 1] }
                : { scale: [1, 1.04, 1] }
            }
            transition={{
              duration: launchPressed ? 0.6 : 1.4,
              repeat: launchPressed ? 0 : Infinity,
            }}
          >
            <Play size={18} fill="white" /> ابدأ الآن
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function LobbyView({
  studentsJoined,
  countdown,
  showStart,
}: {
  studentsJoined: number;
  countdown: number;
  showStart: boolean;
}) {
  return (
    <motion.div
      className="relative z-10 w-full h-full flex flex-col items-center justify-center text-white p-8"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="text-center mb-6">
        <div className="text-sm font-bold uppercase tracking-[0.3em] opacity-80">
          غرفة وميض
        </div>
        <div className="text-2xl font-black mt-1">
          ادخل بهذا الرمز من جهازك
        </div>
      </div>

      {/* Big PIN */}
      <div className="bg-black/30 backdrop-blur-md rounded-3xl border-2 border-white/30 px-12 py-6 mb-8">
        <div className="flex gap-3 font-mono font-black text-7xl tracking-widest">
          {['7', '4', '3', '2', '8', '1'].map((d, i) => (
            <motion.span
              key={i}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.06 }}
            >
              {d}
            </motion.span>
          ))}
        </div>
      </div>

      {/* Joined students count */}
      <div className="flex items-center gap-3 text-white mb-6">
        <Users size={22} />
        <span className="font-bold text-lg">
          انضم {studentsJoined} من 5 طلاب
        </span>
      </div>
      <div className="flex gap-3 mb-8">
        {STUDENTS.map((s, i) => (
          <motion.div
            key={s.name}
            className="flex flex-col items-center gap-1"
            initial={{ y: 30, opacity: 0 }}
            animate={{
              y: i < studentsJoined ? 0 : 30,
              opacity: i < studentsJoined ? 1 : 0,
            }}
            transition={{ delay: i * 0.12, type: 'spring', damping: 16 }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center font-black text-xl border-2 border-white/80 shadow-lg"
              style={{ background: s.color }}
            >
              {s.name.charAt(0)}
            </div>
            <div className="text-xs font-bold">{s.name}</div>
          </motion.div>
        ))}
      </div>

      {/* Countdown */}
      <AnimatePresence mode="wait">
        {countdown > 0 && (
          <motion.div
            key={countdown}
            className="text-[10vw] font-black italic text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.6)]"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {countdown}
          </motion.div>
        )}
        {showStart && (
          <motion.div
            key="start"
            className="text-[10vw] font-black italic text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.8)]"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            ابدأ
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Gameplay({ phase }: { phase: number }) {
  return (
    <motion.div
      className="relative z-10 w-full h-full flex items-stretch p-8 gap-8"
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Question + power-ups */}
      <div className="flex-1 flex flex-col items-center justify-center relative text-white">
        <motion.div
          className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 w-full max-w-2xl relative"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
        >
          <div className="text-3xl font-bold text-center mb-8">
            كم عدد الكواكب في المجموعة الشمسية؟
          </div>
          <div className="grid grid-cols-2 gap-4">
            {['7', '8', '9', '10'].map((ans, i) => (
              <motion.div
                key={i}
                className={`p-6 rounded-xl text-center text-2xl font-bold border-2 ${
                  i === 1 && phase >= 10
                    ? 'bg-white text-amber-600 border-white'
                    : 'bg-black/20 border-white/10 text-white'
                }`}
                animate={
                  i === 1 && phase >= 10 ? { scale: [1, 1.06, 1] } : {}
                }
              >
                {ans}
              </motion.div>
            ))}
          </div>
          {/* Flying +100 */}
          <AnimatePresence>
            {phase === 10 && (
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] z-50"
                initial={{ y: 0, scale: 0, opacity: 1 }}
                animate={{ y: -180, scale: 1.5, opacity: 0 }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
              >
                +100
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Power-ups */}
        <motion.div
          className="flex gap-6 mt-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{
            opacity: phase >= 11 ? 1 : 0,
            y: phase >= 11 ? 0 : 30,
          }}
        >
          <Powerup icon={Snowflake} label="تجميد" delay={0} active={phase >= 11} color="text-blue-400" />
          <Powerup icon={Shield} label="درع الحماية" delay={0.18} active={phase >= 11} color="text-emerald-400" />
          <Powerup icon={Repeat} label="سحب النقاط" delay={0.36} active={phase >= 11} color="text-purple-400" />
        </motion.div>
      </div>

      {/* Leaderboard */}
      <motion.div
        className="w-80 bg-black/25 rounded-3xl p-6 backdrop-blur-md border border-white/10 flex flex-col gap-4 text-white relative"
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, delay: 0.2 }}
      >
        <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
          <Trophy className="text-amber-300" /> المتصدرون
        </h3>
        <LeaderboardRow name="سارة" score={phase >= 12 ? 850 : 650} rank={phase >= 12 ? 1 : 2} isPlayer />
        <LeaderboardRow name="أحمد" score={750} rank={phase >= 12 ? 2 : 1} />
        <LeaderboardRow name="ليلى" score={500} rank={3} />
        <LeaderboardRow name="خالد" score={320} rank={4} />
        <AnimatePresence>
          {phase >= 12 && (
            <motion.div
              className="absolute -left-12 top-24 bg-white text-amber-600 font-black px-4 py-2 rounded-full shadow-xl rotate-12"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 1], opacity: 1 }}
              transition={{ type: 'spring', damping: 12 }}
            >
              أحسنت!
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function Powerup({
  icon: Icon,
  label,
  delay,
  active,
  color,
}: {
  icon: typeof Snowflake;
  label: string;
  delay: number;
  active: boolean;
  color: string;
}) {
  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      initial={{ scale: 0 }}
      animate={active ? { scale: 1 } : { scale: 0 }}
      transition={{ type: 'spring', delay }}
    >
      <div
        className={`w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg ${color}`}
      >
        <Icon size={32} />
      </div>
      <span className="font-bold text-sm bg-black/40 px-3 py-1 rounded-full text-white">
        {label}
      </span>
    </motion.div>
  );
}

function LeaderboardRow({
  name,
  score,
  rank,
  isPlayer = false,
}: {
  name: string;
  score: number;
  rank: number;
  isPlayer?: boolean;
}) {
  return (
    <motion.div
      className={`relative p-3 rounded-xl flex items-center gap-3 overflow-hidden ${
        isPlayer ? 'bg-white/20 border border-white/30' : 'bg-black/20'
      }`}
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <motion.div
        className="absolute left-0 top-0 bottom-0 bg-white/10"
        initial={{ width: '0%' }}
        animate={{ width: `${(score / 1000) * 100}%` }}
        transition={{ duration: 1 }}
      />
      <div className="font-bold text-lg w-6 relative z-10">{rank}</div>
      <div className="w-10 h-10 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center text-xl relative z-10">
        ★
      </div>
      <div className="flex-1 font-bold relative z-10">{name}</div>
      <motion.div className="font-mono font-bold relative z-10" layout>
        {score}
      </motion.div>
    </motion.div>
  );
}
