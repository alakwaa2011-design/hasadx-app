import { motion } from 'framer-motion';
import { SafeFrame } from '@/lib/video/layout';

export function Scene3() {
  return (
    <motion.div
      className="absolute inset-0 z-10"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Background Image (blurred) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 z-0"
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/home-screenshot.jpg`} 
          alt="Platform" 
          className="w-full h-full object-cover blur-xl"
        />
        <div className="absolute inset-0 bg-brand-green-dark/60 mix-blend-multiply" />
      </motion.div>

      <SafeFrame className="flex flex-col items-center justify-center">
        <div className="relative z-10 w-full flex flex-col items-center text-center">
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 1, type: "spring", bounce: 0.4 }}
            className="mb-[8vmin] bg-white/10 p-[6vmin] rounded-full backdrop-blur-md border border-white/20 shadow-[0_0_60px_rgba(255,255,255,0.1)]"
          >
            <img 
              src={`${import.meta.env.BASE_URL}images/logo-hasaad.png`} 
              alt="Hasaad Logo" 
              className="w-[40vmin] h-auto object-contain mx-auto"
            />
          </motion.div>

          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
            className="text-[10vmin] font-bold text-white mb-[4vmin] leading-tight text-shadow-dark"
          >
            ابدأ <span className="text-brand-gold">مجاناً</span> كمعلم
          </motion.h2>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.8, ease: "easeOut" }}
            className="text-[5vmin] text-brand-cream/90 font-body mb-[10vmin] max-w-[80vw] mx-auto leading-relaxed"
          >
            منصة حصاد التعليمية
          </motion.p>
          
          {/* Fake CTA Button */}
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 1.5, duration: 0.8, type: "spring", bounce: 0.6 }}
            className="bg-brand-gold text-brand-green-dark text-[5vmin] font-bold py-[3vmin] px-[8vmin] rounded-full shadow-[0_20px_40px_rgba(217,163,33,0.3)] border-b-4 border-brand-gold-light"
          >
            اشترك الآن
          </motion.div>
        </div>
        
        {/* Search Bar / Browser UI element to show it's web-based */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 2.0, duration: 1, type: "spring" }}
          className="absolute bottom-[5vmin] w-3/4 max-w-md bg-white/10 backdrop-blur-md rounded-full py-[3vmin] px-[5vmin] flex items-center justify-center border border-white/20 shadow-2xl z-10"
        >
          <span className="text-[4vmin] font-body text-white/80 tracking-widest font-mono">
            hasaad.com
          </span>
        </motion.div>
      </SafeFrame>
    </motion.div>
  );
}
