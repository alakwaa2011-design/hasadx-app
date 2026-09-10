import { motion } from 'framer-motion';
import { SafeFrame, VideoText } from '@/lib/video/layout';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 2800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-10"
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <SafeFrame className="flex flex-col items-center justify-between">

        <div className="w-full flex-1 relative mt-[5vmin] mb-[2vmin] perspective-1000">
          <motion.div
            initial={{ rotateX: 30, y: 100, opacity: 0, scale: 0.9 }}
            animate={phase >= 1 ? { rotateX: 5, y: 0, opacity: 1, scale: 1 } : { rotateX: 30, y: 100, opacity: 0, scale: 0.9 }}
            transition={{ duration: 1.2, type: "spring", stiffness: 80, damping: 20 }}
            className="absolute inset-x-[3vmin] top-[5%] bottom-[10%] rounded-[3vmin] overflow-hidden glass-panel shadow-[0_30px_60px_rgba(0,0,0,0.5)] border-2 border-brand-gold/30"
          >
            <img
              src={`${import.meta.env.BASE_URL}images/home-screenshot.jpg`}
              alt="Rewards and Reports"
              className="w-full h-full object-cover object-top opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-green-dark via-brand-green-dark/40 to-transparent opacity-80" />
          </motion.div>

          <motion.div
            initial={{ scale: 0, opacity: 0, x: 20 }}
            animate={phase >= 2 ? { scale: 1, opacity: 1, x: 0 } : { scale: 0, opacity: 0, x: 20 }}
            transition={{ duration: 0.8, type: "spring", bounce: 0.5 }}
            className="absolute -right-[2vmin] top-[30%] bg-brand-cream text-brand-green-dark font-bold py-[1.5vmin] px-[4.5vmin] rounded-full shadow-xl transform rotate-6 border border-brand-green-light"
          >
            <VideoText scale="body">لوحة المكافآت</VideoText>
          </motion.div>

          <motion.div
            initial={{ scale: 0, opacity: 0, x: -20 }}
            animate={phase >= 3 ? { scale: 1, opacity: 1, x: 0 } : { scale: 0, opacity: 0, x: -20 }}
            transition={{ duration: 0.8, type: "spring", bounce: 0.5 }}
            className="absolute -left-[2vmin] bottom-[40%] bg-brand-gold text-brand-green-dark font-bold py-[1.5vmin] px-[4.5vmin] rounded-full shadow-xl transform -rotate-6 border border-white"
          >
            <VideoText scale="body">تقارير وتقدم الطلاب</VideoText>
          </motion.div>
        </div>

        <div className="relative z-20 w-full flex flex-col items-center text-center mb-[8vmin]">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={phase >= 4 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-center justify-center mb-[3vmin]"
          >
            <img
              src={`${import.meta.env.BASE_URL}images/logo-mark-transparent.png`}
              alt="Hasaad Mark"
              className="w-[18%] h-auto object-contain mx-auto mb-[1.5vmin] drop-shadow-[0_0_15px_rgba(217,163,33,0.3)]"
            />
            <VideoText scale="heading" className="text-brand-gold font-bold leading-none tracking-tight">
              حصاد
            </VideoText>
          </motion.div>

          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={phase >= 4 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            className="text-white mb-[4vmin]"
          >
            <VideoText scale="heading" className="leading-tight text-shadow-dark font-black">
              ابدأ <span className="text-brand-gold">مجاناً</span> الآن!
            </VideoText>
          </motion.h2>

          {/* Fake CTA / URL */}
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.9 }}
            animate={phase >= 4 ? { y: 0, opacity: 1, scale: 1 } : { y: 30, opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.8, type: "spring", bounce: 0.6, delay: 0.4 }}
            className="bg-brand-cream/10 backdrop-blur-md text-white border border-brand-gold/50 font-bold py-[2.5vmin] px-[6vmin] rounded-full shadow-[0_20px_40px_rgba(217,163,33,0.15)] flex items-center justify-center"
          >
            <VideoText scale="body" className="font-mono tracking-widest uppercase whitespace-nowrap">
              HASAADX.COM
            </VideoText>
          </motion.div>
        </div>

      </SafeFrame>
    </motion.div>
  );
}