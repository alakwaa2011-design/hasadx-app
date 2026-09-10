import { motion } from 'framer-motion';
import { SafeFrame, VideoText } from '@/lib/video/layout';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 2600),
      setTimeout(() => setPhase(5), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-10"
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <SafeFrame className="flex flex-col justify-between">
        <div className="text-center z-20 mb-[2vmin] mt-[5vmin]">
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: -30, opacity: 0 }}
            transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
          >
            <VideoText scale="display" className="font-bold text-white mb-2 leading-tight text-shadow-dark">
              10 ألعاب <span className="gold-gradient-text">تفاعلية</span>
            </VideoText>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={phase >= 2 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <VideoText scale="heading" className="text-brand-cream/90 text-shadow-dark">
              تجعل التعلم تحدياً ممتعاً
            </VideoText>
          </motion.div>
        </div>

        <div className="flex-1 relative w-full perspective-1000 mt-[2vmin] mb-[5vmin]">
          {/* Main Background Image (Screenshot) */}
          <motion.div
            initial={{ rotateX: 20, y: 50, opacity: 0, scale: 0.9 }}
            animate={phase >= 1 ? { rotateX: 5, y: 0, opacity: 1, scale: 1 } : { rotateX: 20, y: 50, opacity: 0, scale: 0.9 }}
            transition={{ duration: 1.2, type: "spring", stiffness: 80, damping: 20 }}
            className="absolute inset-x-[3vmin] top-0 bottom-[10vmin] rounded-[3vmin] overflow-hidden glass-panel shadow-[0_30px_60px_rgba(0,0,0,0.5)] border-2 border-brand-green-light"
          >
            <img
              src={`${import.meta.env.BASE_URL}images/games-screenshot.jpg`}
              alt="Games"
              className="w-full h-full object-cover object-top opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-brand-green-dark/70 via-transparent to-brand-green-dark/90" />
          </motion.div>

          {/* Video 1: XO */}
          <motion.div
            initial={{ x: -100, y: 20, opacity: 0, rotate: -10 }}
            animate={phase >= 3 ? { x: 0, y: 0, opacity: 1, rotate: -6 } : { x: -100, y: 20, opacity: 0, rotate: -10 }}
            transition={{ duration: 0.9, type: "spring", bounce: 0.4 }}
            className="absolute left-0 top-[15%] w-[65%] h-[40%] rounded-[2vmin] overflow-hidden shadow-2xl border-[3px] border-brand-cream z-20 bg-black"
          >
            <video
              src={`${import.meta.env.BASE_URL}video/hasaad-xo.mp4`}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-[2vmin] left-[2vmin] bg-brand-gold text-brand-green-dark font-bold py-[1vmin] px-[3vmin] rounded-full shadow-lg">
              <VideoText scale="caption">لعبة XO</VideoText>
            </div>
          </motion.div>

          {/* Video 2: Challenge / Tug of War */}
          <motion.div
            initial={{ x: 100, y: 50, opacity: 0, rotate: 10 }}
            animate={phase >= 4 ? { x: 0, y: 0, opacity: 1, rotate: 4 } : { x: 100, y: 50, opacity: 0, rotate: 10 }}
            transition={{ duration: 0.9, type: "spring", bounce: 0.4 }}
            className="absolute right-0 top-[40%] w-[70%] h-[45%] rounded-[2vmin] overflow-hidden shadow-2xl border-[3px] border-brand-gold z-30 bg-black"
          >
            <video
              src={`${import.meta.env.BASE_URL}video/hasaad-challenge.mp4`}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-[2vmin] right-[2vmin] bg-brand-cream text-brand-green-dark font-bold py-[1vmin] px-[3vmin] rounded-full shadow-lg">
              <VideoText scale="caption">شد الحبل ووميض</VideoText>
            </div>
          </motion.div>

          {/* Additional Floating Chips */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={phase >= 5 ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
            transition={{ duration: 0.8, type: "spring", bounce: 0.6 }}
            className="absolute left-[10%] bottom-[5%] bg-brand-green-light text-white font-bold py-[1.5vmin] px-[4vmin] rounded-[2vmin] shadow-xl transform rotate-12 border border-brand-cream/30 z-40"
          >
            <VideoText scale="body">عجلة التحدي</VideoText>
          </motion.div>
        </div>
      </SafeFrame>
    </motion.div>
  );
}