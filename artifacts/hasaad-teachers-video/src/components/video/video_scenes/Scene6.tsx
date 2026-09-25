import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';

/** An explanatory motion graphic, not a screenshot of the Hasaad editor. */
export function Scene6() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 450, callback: () => setBeat(1) },
    { time: 1750, callback: () => setBeat(2) },
    { time: 3050, callback: () => setBeat(3) },
    { time: 4200, callback: () => setBeat(4) },
    { time: 5450, callback: () => setBeat(5) },
    { time: 6550, callback: () => setBeat(6) },
  ]);

  return (
    <motion.section className="shot shot-showcase" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.14 }} transition={{ duration: 0.35 }}>
      <div className="shot-topline dark-line"><span>حصاد</span><span>03 — اشرح وتفاعل</span></div>
      <div className="showcase-heading">
        <span className="eyebrow">لا تتوقف عند الشرح</span>
        <AnimatePresence mode="wait">
          <motion.h2 key={beat >= 3 ? 'video' : 'deck'} initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.34 }}>
            {beat >= 3 ? <>فيديو<br /><em>تفاعلي.</em></> : <>عرض<br /><em>تفاعلي.</em></>}
          </motion.h2>
        </AnimatePresence>
        <p>{beat >= 3 ? 'شاهد ← أجب ← شارك' : 'فكرتك تصبح شرحًا يشد الانتباه'}</p>
      </div>

      <div className="showcase-stage">
        <motion.div className="showcase-deck" initial={{ opacity: 0, y: 90, rotate: -8 }} animate={{ opacity: beat >= 3 ? 0 : 1, y: beat >= 3 ? -90 : 0, rotate: beat >= 3 ? 8 : -3, scale: beat >= 3 ? 0.72 : 1 }} transition={{ duration: 0.55 }}>
          <div className="showcase-deck-back" />
          <div className="showcase-slide">
            <span className="showcase-slide-rule" />
            <span className="showcase-slide-orb" />
            <strong>اسأل</strong>
            <motion.div className="showcase-slide-answers" animate={{ opacity: beat >= 2 ? 1 : 0, y: beat >= 2 ? 0 : 18 }}>
              <span>اكتشف</span><span>شارك</span>
            </motion.div>
          </div>
        </motion.div>
        <AnimatePresence>
          {beat >= 3 && (
            <motion.div className="showcase-film" initial={{ opacity: 0, scale: 0.65, rotate: 7 }} animate={{ opacity: 1, scale: 1, rotate: -2 }} exit={{ opacity: 0, scale: 1.3 }} transition={{ duration: 0.55 }}>
              <div className="showcase-film-art"><div className="showcase-play-symbol" /></div>
              <div className="showcase-film-track"><motion.i initial={{ width: '3%' }} animate={{ width: beat >= 4 ? '63%' : '38%' }} transition={{ duration: 1.05 }} /><b /></div>
              <motion.div className="showcase-question" initial={{ opacity: 0, scale: 0.55, y: 80 }} animate={{ opacity: beat >= 5 ? 1 : 0, scale: beat >= 5 ? 1 : 0.55, y: beat >= 5 ? 0 : 80 }} transition={{ duration: 0.4 }}>
                <strong>والآن دورك!</strong>
                <div><span /><span /><span /></div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <motion.div className="showcase-thread" initial={{ scaleX: 0 }} animate={{ scaleX: beat >= 6 ? 1 : 0 }} transition={{ duration: 0.45 }} />
      <div className="shot-bottomline dark-line"><span>من المشاهدة إلى المشاركة</span><span dir="ltr">03 / 09</span></div>
    </motion.section>
  );
}