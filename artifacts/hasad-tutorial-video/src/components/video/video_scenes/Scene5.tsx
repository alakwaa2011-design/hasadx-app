import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { PlusCircle, Zap, Terminal, type LucideIcon } from 'lucide-react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),  // Icons appear
      setTimeout(() => setPhase(2), 2500), // Icons fade, logo returns
      setTimeout(() => setPhase(3), 8500), // Exit (syncs with VideoTemplate loop)
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: phase >= 3 ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      {/* Phase 1: Recap Icons */}
      {phase < 2 && (
        <motion.div 
          className="flex gap-16 items-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.2, filter: 'blur(10px)' }}
          transition={{ duration: 0.5, staggerChildren: 0.2 }}
        >
          <RecapIcon icon={PlusCircle} label="إنشاء" color="text-emerald-400" delay={0.1} />
          <RecapIcon icon={Zap} label="وميض" color="text-amber-400" delay={0.3} />
          <RecapIcon icon={Terminal} label="اختراق" color="text-emerald-500 font-mono" delay={0.5} />
        </motion.div>
      )}

      {/* Phase 2: Logo Returns */}
      {phase >= 2 && (
        <div className="text-center relative">
          <motion.div
            className="text-[12vw] font-black text-emerald-400 leading-none mb-6"
            initial={{ scale: 1.5, opacity: 0, filter: 'blur(20px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            حصاد
          </motion.div>

          <motion.div
            className="text-[3vw] font-bold text-slate-300"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            حوّل واجبك إلى لعبة.
          </motion.div>

          <motion.div
            className="mt-8 text-xl text-slate-500 font-mono tracking-widest"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1 }}
          >
            HASAD.APP
          </motion.div>
        </div>
      )}

      {/* Decorative background elements matching Scene 1 */}
      <motion.div 
        className="absolute top-[20%] right-[15%] w-32 h-32 rounded-full border-2 border-emerald-500/20"
        animate={{ rotate: 360, scale: [1, 1.2, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />
      <motion.div 
        className="absolute bottom-[20%] left-[15%] w-48 h-48 rounded-full border-2 border-amber-500/20"
        animate={{ rotate: -360, scale: [1, 1.1, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />
    </motion.div>
  );
}

function RecapIcon({ icon: Icon, label, color, delay }: { icon: LucideIcon, label: string, color: string, delay: number }) {
  return (
    <motion.div 
      className="flex flex-col items-center gap-6"
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', delay }}
    >
      <div className={`w-32 h-32 rounded-full bg-slate-800 flex items-center justify-center shadow-2xl border border-slate-700 ${color}`}>
        <Icon size={64} />
      </div>
      <span className={`text-3xl font-bold ${color}`}>{label}</span>
    </motion.div>
  );
}
