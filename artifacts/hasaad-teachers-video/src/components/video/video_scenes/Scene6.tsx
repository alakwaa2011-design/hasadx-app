import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';

function CircuitDiagram() {
  return (
    <svg className="showcase-circuit" viewBox="0 0 300 190" role="img" aria-label="بطارية وسلك مغلق ومصباح مضيء">
      <path d="M35 45 H265 V81 M265 127 V165 H174 M125 165 H35 V45" fill="none" stroke="#d6f0dc" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M122 45 H178" stroke="#f2d07d" strokeWidth="8" strokeLinecap="round" />
      <circle cx="265" cy="104" r="26" fill="#f8d488" stroke="#fff5ce" strokeWidth="5" />
      <path d="M253 102 Q259 113 265 102 Q271 113 277 102 M256 113 H274" fill="none" stroke="#8a5b19" strokeWidth="3" strokeLinecap="round" />
      <path d="M125 148 V182 M146 154 V176 M174 148 V182" stroke="#f2d07d" strokeWidth="5" strokeLinecap="round" />
      <circle cx="265" cy="104" r="39" fill="none" stroke="#f8d488" strokeWidth="2" opacity=".5" />
      <text x="150" y="117" textAnchor="middle" fill="#f5e5bb" fontSize="16" fontFamily="Cairo">دائرة مغلقة</text>
    </svg>
  );
}

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
            <span className="showcase-slide-kicker">علوم · الدائرة الكهربائية</span>
            <strong>متى يضيء<br />المصباح؟</strong>
            <CircuitDiagram />
            <motion.div className="showcase-slide-answers" animate={{ opacity: beat >= 2 ? 1 : 0, y: beat >= 2 ? 0 : 18 }}>
              <span>جرّب</span><span>اكتشف</span><span>شارك</span>
            </motion.div>
          </div>
        </motion.div>
        <AnimatePresence>
          {beat >= 3 && (
            <motion.div className="showcase-film" initial={{ opacity: 0, scale: 0.65, rotate: 7 }} animate={{ opacity: 1, scale: 1, rotate: -2 }} exit={{ opacity: 0, scale: 1.3 }} transition={{ duration: 0.55 }}>
              <div className="showcase-film-art">
                <span className="showcase-film-kicker">تجربة علمية · إضاءة المصباح</span>
                <CircuitDiagram />
                <div className="showcase-play-symbol">▶</div>
              </div>
              <div className="showcase-film-track"><motion.i initial={{ width: '3%' }} animate={{ width: beat >= 4 ? '63%' : '38%' }} transition={{ duration: 1.05 }} /><b /></div>
              <motion.div className="showcase-question" initial={{ opacity: 0, scale: 0.55, y: 80 }} animate={{ opacity: beat >= 5 ? 1 : 0, scale: beat >= 5 ? 1 : 0.55, y: beat >= 5 ? 0 : 80 }} transition={{ duration: 0.4 }}>
                <strong>متى يضيء المصباح؟</strong>
                <div><span>عند قطع السلك</span><span className="correct">عند إغلاق الدائرة ✓</span></div>
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