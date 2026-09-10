import { motion } from 'framer-motion';
import { SafeFrame, VideoText } from '@/lib/video/layout';
import { useEffect, useState } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 1800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-10"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -100, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <SafeFrame className="flex flex-col justify-between">

        <div className="text-center z-20 mt-[10vmin]">
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: -30, opacity: 0 }}
            transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
          >
            <VideoText scale="display" className="font-bold text-white mb-2 text-shadow-dark leading-tight">
              أدوات <span className="gold-gradient-text">ذكاء اصطناعي</span>
            </VideoText>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={phase >= 2 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <VideoText scale="heading" className="text-brand-cream/90 text-shadow-dark">
              حضّر دروسك في ثوانٍ معدودة
            </VideoText>
          </motion.div>
        </div>

        <div className="flex-1 relative w-full perspective-1000 mt-[5vmin] mb-[5vmin]">
          <motion.div
            initial={{ rotateX: 45, rotateY: 0, y: 150, opacity: 0, scale: 0.8 }}
            animate={phase >= 1 ? { rotateX: 10, rotateY: -5, y: 0, opacity: 1, scale: 1 } : { rotateX: 45, rotateY: 0, y: 150, opacity: 0, scale: 0.8 }}
            transition={{ duration: 1.2, type: "spring", stiffness: 80, damping: 20 }}
            className="absolute inset-x-[5vmin] top-0 bottom-[5vmin] rounded-[3vmin] overflow-hidden glass-panel shadow-[0_30px_60px_rgba(0,0,0,0.5)] border-2 border-brand-gold/30"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <img
              src={`${import.meta.env.BASE_URL}images/ai-screenshot.jpg`}
              alt="AI Tools"
              className="w-full h-full object-cover object-top opacity-95"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-green-dark via-brand-green-dark/20 to-transparent opacity-60" />
          </motion.div>

          {/* Floating accent elements */}
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={phase >= 2 ? { scale: 1, opacity: 1, y: 0 } : { scale: 0, opacity: 0, y: 20 }}
            transition={{ duration: 0.8, type: "spring", bounce: 0.5 }}
            className="absolute -right-[2vmin] top-[20%] bg-brand-gold text-brand-green-dark font-bold py-[1.5vmin] px-[4vmin] rounded-full shadow-xl transform rotate-6 border-2 border-brand-cream"
          >
            <VideoText scale="body">مولّد أوراق العمل</VideoText>
          </motion.div>

          <motion.div
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={phase >= 3 ? { scale: 1, opacity: 1, y: 0 } : { scale: 0, opacity: 0, y: 20 }}
            transition={{ duration: 0.8, type: "spring", bounce: 0.5 }}
            className="absolute -left-[2vmin] bottom-[30%] bg-brand-cream text-brand-green-dark font-bold py-[1.5vmin] px-[4vmin] rounded-full shadow-xl transform -rotate-12 border-2 border-brand-green"
          >
            <VideoText scale="body">خطط الدروس</VideoText>
          </motion.div>
        </div>

      </SafeFrame>
    </motion.div>
  );
}