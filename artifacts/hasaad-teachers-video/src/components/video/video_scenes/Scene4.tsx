import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Footage } from '../Footage';

export function Scene4() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 350, callback: () => setBeat(1) },
    { time: 900, callback: () => setBeat(2) },
    { time: 1850, callback: () => setBeat(3) },
    { time: 3150, callback: () => setBeat(4) },
    { time: 5400, callback: () => setBeat(5) },
  ]);
  return (
    <motion.section className="shot shot-tug" initial={{ opacity: 0, scale: 1.12, filter: 'blur(8px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.17 }} transition={{ duration: 0.43 }}>
      <div className="shot-topline"><span>حصاد</span><span>08 — شد الحبل</span></div>
      <div className="tug-heading">
        <span className="eyebrow">منافسة بين فريقين</span>
        <AnimatePresence mode="sync">
          <motion.h2 key={beat >= 4 ? 'winner' : 'teams'} initial={{ opacity: 0, y: 27 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -27 }} transition={{ duration: 0.32 }}>
            {beat >= 4 ? <>الأزرق <em>فاز.</em><br />الأحمر <span className="tug-loser">خسر.</span></> : <>فريقان.<br /><em>سؤال لكل فريق.</em></>}
          </motion.h2>
        </AnimatePresence>
      </div>
      <div className="tug-stage">
        <AnimatePresence mode="sync">
          {beat < 3 ? (
            <motion.div key="duel" className="tug-duel" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.18, filter: 'blur(7px)' }} transition={{ duration: 0.4 }}>
              <div className="tug-arena"><Footage file="tug-arena" /></div>
              <div className="tug-question-pair" dir="ltr">
                <motion.div className="tug-question tug-question-red" initial={{ y: 36 }} animate={{ y: 0 }} transition={{ delay: 0.25, duration: 0.4 }}><Footage file="tug-red" /></motion.div>
                <motion.div className="tug-question tug-question-blue" initial={{ y: 36 }} animate={{ y: 0 }} transition={{ delay: 0.37, duration: 0.4 }}><Footage file="tug-blue" /></motion.div>
              </div>
            </motion.div>
          ) : beat < 4 ? (
            <motion.div key="answer" className="tug-focus" initial={{ opacity: 0, scale: 1.23 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }} transition={{ duration: 0.38 }}>
              <Footage file="tug-answer" />
            </motion.div>
          ) : (
            <motion.div key="winner" className="tug-result" initial={{ opacity: 0, scale: 1.16, filter: 'blur(8px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} transition={{ duration: 0.46 }}>
              <Footage file="tug-win" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {beat >= 4 ? (
        <motion.div className="tug-outcome" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, scale: beat >= 5 ? 1.03 : 1 }} transition={{ duration: 0.38 }}>
          <div className="blue"><span>الأزرق · فائز</span><strong dir="ltr">3200</strong></div>
          <div className="red"><span>الأحمر · خاسر</span><strong dir="ltr">1500</strong></div>
        </motion.div>
      ) : (
        <motion.div className="tug-label" initial={{ opacity: 0 }} animate={{ opacity: beat >= 1 ? 1 : 0 }} transition={{ duration: 0.3 }}>
          {beat >= 3 ? 'الإجابة تغيّر مجرى المباراة' : 'السؤال على الجهتين · الحماس في الميدان'}
        </motion.div>
      )}
      <div className="shot-bottomline"><span>تعلّم وتنافس</span><span dir="ltr">08 / 09</span></div>
    </motion.section>
  );
}