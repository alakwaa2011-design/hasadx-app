import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Footage } from '../Footage';

export function Scene1() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 600, callback: () => setBeat(1) },
    { time: 1700, callback: () => setBeat(2) },
    { time: 4250, callback: () => setBeat(3) },
    { time: 6350, callback: () => setBeat(4) },
  ]);
  return (
    <motion.section className="shot shot-worksheet" initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.18, filter: 'blur(7px)' }} transition={{ duration: 0.45 }}>
      <div className="shot-topline"><span>حصاد</span><span>01 — تحضير الدرس</span></div>
      <div className="feature-heading">
        <span className="eyebrow">من داخل المنصة · تسجيل حقيقي</span>
        <motion.h2 key={beat >= 3 ? 'worksheet' : beat >= 2 ? 'plan' : 'input'} initial={{ y: 36, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.42 }}>
          {beat >= 3 ? <>ورقة عمل<br /><em>جاهزة.</em></> : beat >= 2 ? <>خطة درس<br /><em>كاملة.</em></> : <>فكرة<br /><em>درس.</em></>}
        </motion.h2>
        <p>{beat >= 3 ? 'أسئلة متنوعة للصف' : beat >= 2 ? 'الخطة تظهر أمامك مباشرة' : 'اكتب موضوع الدرس وأنشئ خطته'}</p>
      </div>
      <div className="frame-shadow worksheet-shadow" />
      <div className="frame worksheet-frame">
        <div className="frame-chrome"><span /><span /><span /><strong>{beat >= 3 ? 'إنشاء ورقة عمل' : 'توليد خطة درس'}</strong></div>
        <AnimatePresence mode="sync">
          {beat < 3
            ? <motion.div key="plan" className="frame-content" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.25, filter: 'blur(8px)' }} transition={{ duration: 0.35 }}>
                <Footage file="lesson-plan-process" />
              </motion.div>
            : <motion.div key="worksheet" className="frame-content" initial={{ opacity: 0, scale: 1.22, filter: 'blur(8px)' }} animate={{ opacity: 1, scale: beat >= 4 ? 1.08 : 1, filter: 'blur(0px)' }} transition={{ duration: 0.48 }}>
                <Footage file="worksheet-result-fast" />
              </motion.div>
          }
        </AnimatePresence>
      </div>
      <motion.div className="feature-tag" initial={{ opacity: 0, y: 20 }} animate={{ opacity: beat >= 3 ? 1 : 0, y: beat >= 3 ? 0 : 20 }} transition={{ duration: 0.4 }}>أدوات جاهزة للمعلم</motion.div>
      <div className="shot-bottomline"><span>حضّر بذكاء</span><span>01 / 04</span></div>
    </motion.section>
  );
}