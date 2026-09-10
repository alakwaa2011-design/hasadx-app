import { motion } from 'framer-motion';
import { SafeFrame, VideoText } from '@/lib/video/layout';
import { useEffect, useState } from 'react';

export function Scene0() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 1800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <SafeFrame className="flex flex-col items-center justify-center text-center">

        {/* Animated Background Ring */}
        <motion.div
          className="absolute w-[80%] aspect-square rounded-full border-[1px] border-white/10 z-0"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1.5, opacity: 1 }}
          transition={{ duration: 3, ease: "easeOut" }}
        />

        <div className="relative z-10 flex flex-col items-center justify-center w-full gap-[2vmin]">
          <motion.div
            initial={{ y: 50, scale: 0.8, opacity: 0 }}
            animate={{ y: 0, scale: phase >= 1 ? 0.7 : 1, opacity: 1 }}
            transition={{ duration: 1, type: "spring", stiffness: 100, damping: 20 }}
            className="flex flex-col items-center"
          >
            <img
              src={`${import.meta.env.BASE_URL}images/logo-mark-transparent.png`}
              alt="Hasaad Mark"
              className="w-[35%] object-contain drop-shadow-[0_0_30px_rgba(217,163,33,0.3)]"
            />
          </motion.div>

          <motion.div
            className="flex flex-col items-center gap-[3vmin]"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <VideoText
              scale="display"
              className="text-white leading-tight font-black"
            >
              منصة <span className="gold-gradient-text">حصاد</span>
            </VideoText>

            <motion.div
              initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
              animate={phase >= 2 ? { opacity: 1, clipPath: 'inset(0 0% 0 0)' } : { opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            >
              <VideoText scale="heading" className="text-brand-cream/90 font-bold max-w-[90%] mx-auto px-[4vmin] leading-normal">
                من فكرة الدرس.. إلى تجربة تعليمية كاملة
              </VideoText>
            </motion.div>
          </motion.div>
        </div>

      </SafeFrame>
    </motion.div>
  );
}