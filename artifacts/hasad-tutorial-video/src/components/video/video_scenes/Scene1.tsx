import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),  // Logo appears
      setTimeout(() => setPhase(2), 2000), // Tagline
      setTimeout(() => setPhase(3), 4000), // Promise
      setTimeout(() => setPhase(4), 8500), // Exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: phase >= 4 ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <div className="relative text-center">
        {/* Logo */}
        <motion.div
          className="text-[12vw] font-black text-emerald-400 leading-none mb-6"
          initial={{ scale: 0.5, opacity: 0, y: 50 }}
          animate={phase >= 1 ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.5, opacity: 0, y: 50 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          حصاد
        </motion.div>

        {/* Tagline */}
        <motion.div
          className="text-[3vw] font-bold text-slate-300"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          حوّل واجبك إلى لعبة.
        </motion.div>

        {/* Promise */}
        <motion.div
          className="mt-12 text-[2.5vw] font-semibold text-amber-400 bg-slate-800/50 px-8 py-4 rounded-full border border-amber-400/30"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          في 3 خطوات، ولعبتين.
        </motion.div>
      </div>

      {/* Decorative background elements */}
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
