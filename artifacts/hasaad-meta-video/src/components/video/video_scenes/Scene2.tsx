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
            على السبورة ومن أجهزة الطلاب
          </motion.p>
        </div>

        <div className="flex-1 relative w-full perspective-1000 mt-[3vmin] flex flex-col gap-[3vmin]">
          <motion.div
            initial={{ rotateX: -20, rotateY: 15, y: 50, opacity: 0, scale: 0.8 }}
            animate={{ rotateX: 0, rotateY: 0, y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 1.2, type: "spring", stiffness: 80, damping: 20 }}
            className="relative w-full h-[52%] rounded-3xl overflow-hidden border-2 border-brand-gold/30 shadow-[0_40px_80px_rgba(217,163,33,0.2)] bg-black"
          >
            <video
              src={`${import.meta.env.BASE_URL}video/hasaad-challenge.mp4`}
              poster={`${import.meta.env.BASE_URL}images/games-screenshot.jpg`}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-brand-green-dark/40 via-transparent to-brand-green-dark/60" />
            <div className="absolute top-3 right-3 bg-brand-gold text-brand-green-dark font-bold py-2 px-4 rounded-full text-[3.5vmin] shadow-xl">
              على السبورة
            </div>
          </motion.div>
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 1, duration: 0.9, type: "spring", stiffness: 80, damping: 20 }}
            className="relative w-[82%] h-[38%] self-center rounded-3xl overflow-hidden border-2 border-brand-cream/30 shadow-[0_30px_60px_rgba(0,0,0,0.35)] bg-black"
          >
            <video
              src={`${import.meta.env.BASE_URL}video/hasaad-xo.mp4`}
              poster={`${import.meta.env.BASE_URL}images/games-screenshot.jpg`}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-green-dark/65 via-transparent to-transparent" />
            <div className="absolute bottom-3 right-3 bg-brand-cream text-brand-green-dark font-bold py-2 px-4 rounded-full text-[3.2vmin] shadow-xl">
              من جهاز الطالب
            </div>
          </motion.div>

          {/* Floating game icons/chips */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.8, type: "spring", bounce: 0.6 }}
            className="absolute left-[-2vmin] top-[15vmin] bg-brand-green-light text-white font-bold py-3 px-6 rounded-2xl text-[4vmin] shadow-xl transform -rotate-12 border border-brand-cream/20"
          >
            وميض • شد الحبل • XO
          </motion.div>
          
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.8, duration: 0.8, type: "spring", bounce: 0.5 }}
            className="absolute right-[-2vmin] bottom-[15vmin] bg-brand-gold text-brand-green-dark font-bold py-3 px-6 rounded-2xl text-[4vmin] shadow-xl transform rotate-6"
          >
            عجلة التحدي • حماس ومنافسة
          </motion.div>
        </div>
      </SafeFrame>
    </motion.div>
  );
}
