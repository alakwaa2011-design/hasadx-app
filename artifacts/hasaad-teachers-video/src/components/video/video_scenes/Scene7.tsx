import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';

/** A graphic metaphor for the wheel and random student picker. */
export function Scene7() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 450, callback: () => setBeat(1) },
    { time: 950, callback: () => setBeat(2) },
    { time: 3100, callback: () => setBeat(3) },
    { time: 4050, callback: () => setBeat(4) },
    { time: 5350, callback: () => setBeat(5) },
  ]);

  return (
    <motion.section className="shot shot-picker" initial={{ opacity: 0, clipPath: 'circle(7% at 55% 60%)' }} animate={{ opacity: 1, clipPath: 'circle(130% at 55% 60%)' }} exit={{ opacity: 0, scale: 1.15 }} transition={{ duration: 0.5 }}>
      <div className="shot-topline"><span>حصاد</span><span>05 — الجميع يشارك</span></div>
      <div className="picker-heading">
        <span className="eyebrow">من يشارك بعد ذلك؟</span>
        <h2>{beat >= 4 ? <>اختَر <em>طالبًا.</em></> : <>دوّر <em>العجلة.</em></>}</h2>
        <p>{beat >= 4 ? 'اختيار عشوائي · فرصة للجميع' : 'مفاجأة جديدة مع كل دور'}</p>
      </div>
      <div className="picker-stage">
        <motion.div className="picker-wheel-wrap" animate={{ scale: beat >= 4 ? 0.68 : 1, x: beat >= 4 ? '-36%' : 0, opacity: beat >= 5 ? 0.32 : 1 }} transition={{ duration: 0.58 }}>
          <div className="picker-arrow" />
          <motion.div className="picker-wheel" initial={{ rotate: -35, scale: 0.45 }} animate={{ rotate: beat >= 2 ? 1090 : 0, scale: 1 }} transition={{ rotate: { duration: 2.45, ease: [0.1, 0.75, 0.16, 1] }, scale: { duration: 0.55 } }}>
            <span>١</span><span>٢</span><span>٣</span><span>٤</span>
            <div className="picker-wheel-center">؟</div>
          </motion.div>
        </motion.div>
        <motion.div className="picker-student" initial={{ opacity: 0, y: 90, rotate: 12, scale: 0.7 }} animate={{ opacity: beat >= 4 ? 1 : 0, y: beat >= 4 ? 0 : 90, rotate: beat >= 4 ? -4 : 12, scale: beat >= 4 ? 1 : 0.7 }} transition={{ type: 'spring', stiffness: 290, damping: 21 }}>
          <div className="picker-avatar"><i /><b /></div>
          <span>الدور التالي</span>
          <strong>طالب من الصف</strong>
        </motion.div>
      </div>
      <motion.div className="picker-cross" initial={{ opacity: 0, scale: 0.2, rotate: -35 }} animate={{ opacity: beat >= 5 ? 1 : 0, scale: beat >= 5 ? 1 : 0.2, rotate: 0 }} transition={{ duration: 0.46 }}>×</motion.div>
      <div className="shot-bottomline"><span>الكل ينتظر دوره</span><span dir="ltr">05 / 09</span></div>
    </motion.section>
  );
}