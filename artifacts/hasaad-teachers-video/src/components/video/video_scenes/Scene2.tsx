import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Footage } from '../Footage';

export function Scene2() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 450, callback: () => setBeat(1) },
    { time: 1350, callback: () => setBeat(2) },
    { time: 2300, callback: () => setBeat(3) },
    { time: 3550, callback: () => setBeat(4) },
  ]);
  return (
    <motion.section className="shot shot-map" initial={{ opacity: 0, clipPath: 'circle(10% at 52% 70%)' }} animate={{ opacity: 1, clipPath: 'circle(130% at 52% 70%)' }} exit={{ opacity: 0, scale: 1.12 }} transition={{ duration: 0.6 }}>
      <div className="shot-topline dark-line"><span>حصاد</span><span>{beat >= 4 ? '04 — لوحة التحفيز' : '04 — الخريطة الذهنية'}</span></div>
      <div className="map-heading">
        <span className="eyebrow">{beat >= 4 ? 'كل تقدّم يستحق تشجيعًا' : 'حين تصبح الفكرة صورة'}</span>
        <motion.h2 key={beat >= 4 ? 'reward' : 'map'} initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.34 }}>
          {beat >= 4 ? <>لوحة<br /><em>التحفيز.</em></> : <>اربط <em>الأفكار.</em></>}
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: beat >= 3 ? 1 : 0, y: beat >= 3 ? 0 : 20 }}>{beat >= 4 ? 'نقاط الصف أمامك لحظة بلحظة' : 'بخريطة واحدة واضحة'}</motion.p>
      </div>
      <div className="map-thread map-thread-a" /><div className="map-thread map-thread-b" />
      <div className={`frame ${beat >= 4 ? 'reward-frame' : 'map-frame'}`}>
        <div className="frame-chrome"><span /><span /><span /><strong>{beat >= 4 ? 'لوحة تحفيز الصف' : 'من موضوع إلى خريطة'}</strong></div>
        <AnimatePresence mode="sync">
          {beat >= 4
            ? <motion.div key="reward-board" className="frame-content" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.38 }}><Footage file="reward-board-redacted" /></motion.div>
            : beat < 2
              ? <motion.div key="map-input" className="frame-content" exit={{ opacity: 0, scale: 1.3 }} transition={{ duration: 0.3 }}><Footage file="map-input" /></motion.div>
              : <motion.div key="map-result" className="frame-content" initial={{ opacity: 0, scale: 1.3 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.55 }}><Footage file="map-result" /></motion.div>
          }
        </AnimatePresence>
      </div>
      {beat < 4 && <motion.div className="map-detail" initial={{ opacity: 0, y: 45, rotate: 5 }} animate={{ opacity: beat >= 3 ? 1 : 0, y: beat >= 3 ? 0 : 45, rotate: beat >= 3 ? -3 : 5 }} transition={{ duration: 0.52 }}>
        <Footage file="map-result" />
        <span>انظر كيف تتصل المفاهيم</span>
      </motion.div>}
      <div className="shot-bottomline dark-line"><span>{beat >= 4 ? 'حفّز طلابك' : 'نظّم المحتوى'}</span><span dir="ltr">04 / 09</span></div>
    </motion.section>
  );
}