import { motion } from 'framer-motion';
import { SafeFrame } from '@/lib/video/layout';

export function Scene1() {
  return (
    <motion.div
      className="absolute inset-0 z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <SafeFrame className="flex flex-col justify-between">
        <div className="flex-1 relative w-full perspective-1000 mt-[10vmin]">
          <motion.div
            initial={{ rotateX: 30, rotateY: -20, y: 100, opacity: 0, scale: 0.8 }}
            animate={{ rotateX: 5, rotateY: -5, y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 1.2, type: "spring", stiffness: 80, damping: 20 }}
            className="absolute inset-x-0 top-0 bottom-[10vmin] rounded-3xl overflow-hidden glass-panel shadow-[0_30px_60px_rgba(0,0,0,0.4)]"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <img 
              src={`${import.meta.env.BASE_URL}images/ai-screenshot.jpg`} 
              alt="AI Tools" 
              className="w-full h-full object-cover object-top opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-green-dark via-transparent to-transparent opacity-80" />
          </motion.div>
          
          {/* Floating accent elements */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8, type: "spring" }}
            className="absolute -right-4 top-[10vmin] bg-brand-gold text-brand-green-dark font-bold py-3 px-6 rounded-full text-[4vmin] shadow-xl transform rotate-12"
          >
            مولّد أوراق العمل
          </motion.div>
          
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.8, type: "spring" }}
            className="absolute -left-4 bottom-[20vmin] bg-brand-cream text-brand-green-dark font-bold py-3 px-6 rounded-full text-[4vmin] shadow-xl transform -rotate-6"
          >
            في ثوانٍ!
          </motion.div>
        </div>

        <div className="text-center z-20 mt-auto mb-[5vmin]">
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
            className="text-[9vmin] font-bold text-white mb-4 leading-tight text-shadow-dark"
          >
            أدوات <span className="gold-gradient-text">ذكاء اصطناعي</span>
          </motion.h2>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8, ease: "easeOut" }}
            className="text-[5vmin] text-brand-cream/90 font-body max-w-[80vw] mx-auto leading-relaxed text-shadow-dark"
          >
            تفهم المنهج العربي وتصنع المحتوى
          </motion.p>
        </div>
      </SafeFrame>
    </motion.div>
  );
}
