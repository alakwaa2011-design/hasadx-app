import { motion } from 'framer-motion';
import { SafeFrame } from '@/lib/video/layout';

export function Scene2() {
  return (
    <motion.div
      className="absolute inset-0 z-10"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <SafeFrame className="flex flex-col justify-between">
        <div className="text-center z-20 mb-[5vmin] mt-[5vmin]">
          <motion.h2
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
            className="text-[9vmin] font-bold text-white mb-4 leading-tight text-shadow-dark"
          >
            ألعاب <span className="gold-gradient-text">تفاعلية</span>
          </motion.h2>

          <motion.p
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.8, ease: "easeOut" }}
            className="text-[5vmin] text-brand-cream/90 font-body max-w-[80vw] mx-auto leading-relaxed text-shadow-dark"
          >
            تجعل التعلم تنافساً ممتعاً
          </motion.p>
        </div>

        <div className="flex-1 relative w-full perspective-1000 mt-[5vmin]">
          <motion.div
            initial={{ rotateX: -20, rotateY: 15, y: 50, opacity: 0, scale: 0.8 }}
            animate={{ rotateX: 0, rotateY: 0, y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 1.2, type: "spring", stiffness: 80, damping: 20 }}
            className="absolute inset-x-0 top-0 bottom-[10vmin] rounded-3xl overflow-hidden border-2 border-brand-gold/30 shadow-[0_40px_80px_rgba(217,163,33,0.2)]"
          >
            <img 
              src={`${import.meta.env.BASE_URL}images/games-screenshot.jpg`} 
              alt="Educational Games" 
              className="w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-brand-green-dark/40 via-transparent to-brand-green-dark/60" />
          </motion.div>
          
          {/* Floating game icons/chips */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.8, type: "spring", bounce: 0.6 }}
            className="absolute left-[-2vmin] top-[15vmin] bg-brand-green-light text-white font-bold py-3 px-6 rounded-2xl text-[4vmin] shadow-xl transform -rotate-12 border border-brand-cream/20"
          >
            🎮 +10 ألعاب
          </motion.div>
          
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.8, duration: 0.8, type: "spring", bounce: 0.5 }}
            className="absolute right-[-2vmin] bottom-[15vmin] bg-brand-gold text-brand-green-dark font-bold py-3 px-6 rounded-2xl text-[4vmin] shadow-xl transform rotate-6"
          >
            🏆 حماس ومنافسة
          </motion.div>
        </div>
      </SafeFrame>
    </motion.div>
  );
}
