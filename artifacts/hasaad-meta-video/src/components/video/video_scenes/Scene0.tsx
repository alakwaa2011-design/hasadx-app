import { motion } from 'framer-motion';
import { SafeFrame } from '@/lib/video/layout';

export function Scene0() {
  return (
    <motion.div
      className="absolute inset-0 z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <SafeFrame className="flex flex-col items-center justify-center text-center">
        <motion.div
          initial={{ y: 50, scale: 0.8, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 1, type: "spring", stiffness: 100, damping: 20 }}
          className="mb-12"
        >
          <img 
            src={`${import.meta.env.BASE_URL}images/logo-mark-transparent.png`} 
            alt="Hasaad Mark" 
            className="w-48 h-48 object-contain mx-auto drop-shadow-2xl"
          />
        </motion.div>

        <motion.h1
          initial={{ y: 30, opacity: 0, rotateX: 20 }}
          animate={{ y: 0, opacity: 1, rotateX: 0 }}
          transition={{ delay: 0.6, duration: 0.8, type: "spring", stiffness: 120, damping: 20 }}
          className="text-[12vmin] font-bold text-white mb-6 tracking-tight leading-tight"
          style={{ perspective: 1000 }}
        >
          منصة <span className="gold-gradient-text">حصاد</span>
        </motion.h1>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.8, ease: "easeOut" }}
        >
          <p className="text-[5vmin] text-brand-cream/90 font-body max-w-[80vw] mx-auto leading-relaxed">
            من فكرة الدرس إلى تجربة تعليمية كاملة
          </p>
        </motion.div>
        
        {/* Decorative accent line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 1.4, duration: 1, ease: "easeInOut" }}
          className="mt-12 h-1 w-[20vmin] rounded-full"
          style={{ background: 'linear-gradient(90deg, transparent, var(--brand-gold), transparent)', transformOrigin: "center" }}
        />
      </SafeFrame>
    </motion.div>
  );
}
