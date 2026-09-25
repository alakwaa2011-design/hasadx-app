import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';

export function Scene0() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 450, callback: () => setBeat(1) },
    { time: 970, callback: () => setBeat(2) },
    { time: 1850, callback: () => setBeat(3) },
  ]);
  return (
    <motion.section className="shot shot-hook" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.14 }} transition={{ duration: 0.35 }}>
      <div className="hook-index">حصاد / للمعلمين</div>
      <motion.div className="paper paper-back" initial={{ rotate: 28, y: '45%', scale: 0.65 }} animate={{ rotate: -12, y: 0, scale: 1 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
        <i /><i /><i /><i />
      </motion.div>
      <motion.div className="paper paper-front" initial={{ rotate: -28, x: '50%', y: '80%', scale: 0.75 }} animate={{ rotate: 7, x: 0, y: beat >= 3 ? '-17%' : 0, scale: beat >= 3 ? 1.18 : 1 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
        <i /><i /><i />
      </motion.div>
      <div className="hook-copy">
        <motion.p initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}>درس الغد؟</motion.p>
        <motion.h1 initial={{ opacity: 0, y: 45 }} animate={beat >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 45 }} transition={{ duration: 0.32 }}>من <span>الصفر؟</span></motion.h1>
        <motion.small initial={{ opacity: 0 }} animate={{ opacity: beat >= 2 ? 1 : 0 }} transition={{ duration: 0.28 }}>ليس بعد الآن.</motion.small>
      </div>
      <motion.div className="hook-rule" initial={{ scaleX: 0 }} animate={{ scaleX: beat >= 2 ? 1 : 0 }} transition={{ duration: 0.5 }} />
      <div className="hook-footer">01 / من الفكرة إلى التفاعل</div>
    </motion.section>
  );
}