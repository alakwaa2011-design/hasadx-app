import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';

export function Scene5() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 80, callback: () => setBeat(1) },
    { time: 1050, callback: () => setBeat(2) },
    { time: 1700, callback: () => setBeat(3) },
    { time: 2700, callback: () => setBeat(4) },
  ]);
  return (
    <motion.section className="shot shot-outro" initial={{ clipPath: 'circle(12% at 50% 35%)' }} animate={{ clipPath: 'circle(135% at 50% 35%)' }} exit={{ opacity: 0, scale: 1.12 }} transition={{ duration: 0.58 }}>
      <div className="outro-top">من الفكرة · إلى التفاعل</div>
      <motion.div className="outro-mark" initial={{ opacity: 0.45, scale: 1.15, rotate: -5 }} animate={{ opacity: beat >= 1 ? 1 : 0.45, scale: beat >= 1 ? 1 : 1.15, rotate: beat >= 1 ? 0 : -5 }} transition={{ duration: 0.35 }}>
        <img src={`${import.meta.env.BASE_URL}images/logo-mark-transparent.png`} alt="شعار حصاد" />
      </motion.div>
      <motion.h2 initial={{ opacity: 0, y: 30 }} animate={{ opacity: beat >= 2 ? 1 : 0, y: beat >= 2 ? 0 : 30 }} transition={{ duration: 0.42 }}>حصاد</motion.h2>
      <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: beat >= 2 ? 1 : 0, y: beat >= 2 ? 0 : 20 }} transition={{ duration: 0.4 }}>من التحضير إلى التفاعل</motion.p>
      <motion.div className="outro-cta" initial={{ opacity: 0, y: 22 }} animate={{ opacity: beat >= 4 ? 1 : 0, y: beat >= 4 ? 0 : 22 }} transition={{ duration: 0.42 }}>سَجِّلْ الآن في حصاد</motion.div>
      <motion.div className="outro-rule" initial={{ scaleX: 0 }} animate={{ scaleX: beat >= 4 ? 1 : 0 }} transition={{ duration: 0.6 }} />
      <div className="outro-bottom">للمعلمين والمعلمات</div>
    </motion.section>
  );
}