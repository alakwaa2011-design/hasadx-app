import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Footage } from '../Footage';

export function Scene2() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 550, callback: () => setBeat(1) },
    { time: 1600, callback: () => setBeat(2) },
    { time: 2850, callback: () => setBeat(3) },
    { time: 4300, callback: () => setBeat(4) },
  ]);
  return (
    <motion.section className="shot shot-map" initial={{ opacity: 0, clipPath: 'circle(10% at 52% 70%)' }} animate={{ opacity: 1, clipPath: 'circle(130% at 52% 70%)' }} exit={{ opacity: 0, scale: 1.12 }} transition={{ duration: 0.6 }}>
      <div className="shot-topline dark-line"><span>حصاد</span><span>02 — الخريطة الذهنية</span></div>
      <div className="map-heading">
        <span className="eyebrow">حين تصبح الفكرة صورة</span>
        <h2>اربط <em>الأفكار.</em></h2>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: beat >= 3 ? 1 : 0, y: beat >= 3 ? 0 : 20 }}>بخريطة واحدة واضحة</motion.p>
      </div>
      <div className="map-thread map-thread-a" /><div className="map-thread map-thread-b" />
      <div className="frame map-frame">
        <div className="frame-chrome"><span /><span /><span /><strong>من موضوع إلى خريطة</strong></div>
        <AnimatePresence mode="sync">
          {beat < 2
            ? <motion.div key="map-input" className="frame-content" exit={{ opacity: 0, scale: 1.3 }} transition={{ duration: 0.3 }}><Footage file="map-input" /></motion.div>
            : <motion.div key="map-result" className="frame-content" initial={{ opacity: 0, scale: 1.3 }} animate={{ opacity: 1, scale: beat >= 4 ? 1.14 : 1 }} transition={{ duration: 0.55 }}><Footage file="map-result" /></motion.div>
          }
        </AnimatePresence>
      </div>
      <motion.div className="map-detail" initial={{ opacity: 0, y: 45, rotate: 5 }} animate={{ opacity: beat >= 3 ? 1 : 0, y: beat >= 3 ? 0 : 45, rotate: beat >= 3 ? -3 : 5 }} transition={{ duration: 0.52 }}>
        <Footage file="map-result" />
        <span>انظر كيف تتصل المفاهيم</span>
      </motion.div>
      <div className="shot-bottomline dark-line"><span>نظّم المحتوى</span><span>02 / 04</span></div>
    </motion.section>
  );
}