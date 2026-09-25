import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Footage } from '../Footage';

export function Scene3() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 480, callback: () => setBeat(1) },
    { time: 950, callback: () => setBeat(2) },
    { time: 2650, callback: () => setBeat(3) },
    { time: 4800, callback: () => setBeat(4) },
    { time: 5850, callback: () => setBeat(5) },
  ]);
  const file = beat < 2 ? 'game-box' : beat < 4 ? 'game-question' : 'game-trophy';
  return (
    <motion.section className="shot shot-game" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.23, filter: 'blur(8px)' }} transition={{ duration: 0.35 }}>
      <div className="shot-topline"><span>حصاد</span><span>07 — وميض</span></div>
      <motion.div className="game-orbit" animate={{ rotate: 360 }} transition={{ duration: 9, repeat: Infinity, ease: 'linear' }} />
      <div className="game-heading">
        <span className="eyebrow">التعلّم يبدأ بسؤال</span>
        <AnimatePresence mode="sync">
          <motion.h2 key={beat >= 4 ? 'share' : 'challenge'} initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -35 }} transition={{ duration: 0.38 }}>
            {beat >= 4 ? <>والصف <em>يشارك.</em></> : <>السؤال يصبح<br /><em>تحدّيًا.</em></>}
          </motion.h2>
        </AnimatePresence>
      </div>
      <div className={`game-video-window ${beat >= 4 ? 'game-video-trophy' : ''}`}>
        <AnimatePresence mode="sync">
          <motion.div key={file} className="frame-content" initial={{ opacity: 0, scale: 1.12 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.12 }} transition={{ duration: 0.28 }}>
            <Footage file={file} />
          </motion.div>
        </AnimatePresence>
      </div>
      <motion.div className="game-label" initial={{ opacity: 0 }} animate={{ opacity: beat >= 1 ? 1 : 0 }}>
        {beat >= 4 ? 'من المنافسة إلى لحظة الإنجاز' : beat >= 2 ? 'فرديًا أو ضمن فريق' : 'مفاجأة وراء كل جولة'}
      </motion.div>
      <div className="shot-bottomline"><span>على السبورة أو أجهزة الطلاب</span><span dir="ltr">07 / 09</span></div>
    </motion.section>
  );
}