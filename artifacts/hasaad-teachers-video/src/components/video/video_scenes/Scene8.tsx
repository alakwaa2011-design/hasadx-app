import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Footage } from '../Footage';

export function Scene8() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 350, callback: () => setBeat(1) },
    { time: 1300, callback: () => setBeat(2) },
    { time: 2750, callback: () => setBeat(3) },
    { time: 4100, callback: () => setBeat(4) },
    { time: 5450, callback: () => setBeat(5) },
  ]);

  return (
    <motion.section className="shot shot-xo" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.21 }} transition={{ duration: 0.35 }}>
      <div className="shot-topline"><span>حصاد</span><span>06 — لعبة إكس أو</span></div>
      <div className="xo-heading">
        <span className="eyebrow">سؤال واحد يغيّر اللعب</span>
        <motion.h2 initial={{ opacity: 0, y: 28 }} animate={{ opacity: beat >= 1 ? 1 : 0, y: beat >= 1 ? 0 : 28 }} transition={{ duration: 0.38 }}>إكس <em>أو.</em></motion.h2>
        <p>{beat >= 4 ? 'علامة واحدة تقلب الجولة' : 'سؤال ← إجابة ← علامة'}</p>
      </div>
      <div className="xo-ghost xo-ghost-x">×</div>
      <div className="xo-ghost xo-ghost-o">○</div>
      <motion.div className="xo-recording" initial={{ opacity: 0, scale: 0.78, rotate: 6 }} animate={{ opacity: 1, scale: beat >= 4 ? 1.12 : 1, rotate: beat >= 4 ? 0 : -2 }} transition={{ duration: 0.48, ease: [0.2, 0.8, 0.25, 1] }}>
        <Footage file="xo-game" />
        <span className="xo-recording-caption">من تسجيل اللعبة الحقيقي</span>
      </motion.div>
      <motion.div className="xo-stamp" initial={{ opacity: 0, scale: 2.1, rotate: -25 }} animate={{ opacity: beat >= 5 ? 1 : 0, scale: beat >= 5 ? 1 : 2.1, rotate: beat >= 5 ? 0 : -25 }} transition={{ duration: 0.36 }}>X</motion.div>
      <div className="shot-bottomline"><span>أي فريق سيكسب الخانة التالية؟</span><span dir="ltr">06 / 09</span></div>
    </motion.section>
  );
}