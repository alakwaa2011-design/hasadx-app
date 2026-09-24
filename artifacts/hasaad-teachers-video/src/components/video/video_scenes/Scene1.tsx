import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Footage } from '../Footage';

export function Scene1() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 600, callback: () => setBeat(1) },
    { time: 2650, callback: () => setBeat(2) },
    { time: 3250, callback: () => setBeat(3) },
    { time: 5700, callback: () => setBeat(4) },
  ]);
  return (
    <motion.section className="shot shot-worksheet" initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.18, filter: 'blur(7px)' }} transition={{ duration: 0.45 }}>
      <div className="shot-topline"><span>حصاد</span><span>01 — ورقة العمل</span></div>
      <div className="feature-heading">
        <span className="eyebrow">من داخل المنصة · تسجيل حقيقي</span>
        <motion.h2 key={beat >= 3 ? 'result' : 'input'} initial={{ y: 36, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.42 }}>
          {beat >= 3 ? <>ورقة عمل<br /><em>جاهزة.</em></> : <>فكرة<br /><em>درس.</em></>}
        </motion.h2>
        <p>{beat >= 3 ? 'من موضوع المغناطيس إلى أسئلة الصف' : 'اكتب الموضوع الذي تريد تدريسه'}</p>
      </div>
      <div className="frame-shadow worksheet-shadow" />
      <div className="frame worksheet-frame">
        <div className="frame-chrome"><span /><span /><span /><strong>إنشاء ورقة عمل</strong></div>
        <AnimatePresence mode="sync">
          {beat < 2
            ? <motion.div key="input" className="frame-content" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.25, filter: 'blur(8px)' }} transition={{ duration: 0.35 }}>
                <Footage file="worksheet-input" />
              </motion.div>
            : <motion.div key="result" className="frame-content" initial={{ opacity: 0, scale: 1.22, filter: 'blur(8px)' }} animate={{ opacity: 1, scale: beat >= 4 ? 1.08 : 1, filter: 'blur(0px)' }} transition={{ duration: 0.48 }}>
                <Footage file="worksheet-result" />
              </motion.div>
          }
        </AnimatePresence>
      </div>
      <motion.div className="feature-tag" initial={{ opacity: 0, y: 20 }} animate={{ opacity: beat >= 3 ? 1 : 0, y: beat >= 3 ? 0 : 20 }} transition={{ duration: 0.4 }}>من حصاد ← إلى طلابك</motion.div>
      <div className="shot-bottomline"><span>حضّر بذكاء</span><span>01 / 03</span></div>
    </motion.section>
  );
}