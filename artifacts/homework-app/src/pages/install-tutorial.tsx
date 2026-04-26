import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SCENES = ["intro", "hook", "iphone", "android", "outro"] as const;
type Scene = (typeof SCENES)[number];

const DURATIONS: Record<Scene, number> = {
  intro: 4000,
  hook: 4000,
  iphone: 8000,
  android: 8000,
  outro: 5000,
};

const GOLD = "hsl(43,74%,49%)";
const GREEN = "hsl(145,55%,32%)";

function Background() {
  const items = [
    "؟","🧠","🎯","⭐","🏆","؟","📚","🎮","؟","💡","🏅","؟","🔬","🌍","؟","📖",
  ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {items.map((icon, i) => (
        <motion.div
          key={i}
          className="absolute flex items-center justify-center rounded-xl select-none text-sm font-bold"
          style={{
            left: `${(i * 6.2 + 1) % 95}%`,
            bottom: -50,
            width: 36,
            height: 36,
            background: icon === "؟" ? "rgba(196,149,24,0.12)" : "rgba(45,106,79,0.12)",
            border: icon === "؟" ? "1px solid rgba(196,149,24,0.25)" : "1px solid rgba(45,106,79,0.25)",
            color: icon === "؟" ? "hsl(43,74%,55%)" : "rgba(255,255,255,0.4)",
            fontFamily: "'Tajawal', sans-serif",
          }}
          animate={{ y: [0, -(window.innerHeight + 100)], opacity: [0, 0.6, 0.6, 0] }}
          transition={{
            duration: 18 + (i % 8) * 2,
            repeat: Infinity,
            delay: (i * 1.4) % 12,
            ease: "linear",
          }}
        >
          {icon}
        </motion.div>
      ))}
    </div>
  );
}

function AppIcon({ size = 80 }: { size?: number }) {
  return (
    <img
      src="/icons/icon-192.png"
      alt="حصاد"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        boxShadow: `0 8px 32px rgba(45,106,79,0.6), 0 0 0 2px rgba(196,149,24,0.3)`,
        display: "block",
      }}
    />
  );
}

function ProgressBars({ current, total, duration }: { current: number; total: number; duration: number }) {
  return (
    <div className="absolute top-5 left-0 right-0 flex justify-center gap-2 z-50 px-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[3px] rounded-full overflow-hidden flex-1"
          style={{ maxWidth: 100, background: "rgba(255,255,255,0.18)" }}
        >
          {i === current && (
            <motion.div
              className="h-full rounded-full"
              style={{ background: GOLD }}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: duration / 1000, ease: "linear" }}
            />
          )}
          {i < current && (
            <div className="h-full w-full rounded-full" style={{ background: GOLD }} />
          )}
        </div>
      ))}
    </div>
  );
}

function NavDots({ current, total, onSelect }: { current: number; total: number; onSelect: (i: number) => void }) {
  return (
    <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2 z-50">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === current ? 20 : 7,
            height: 7,
            background: i === current ? GOLD : "rgba(255,255,255,0.3)",
          }}
        />
      ))}
    </div>
  );
}

function SceneIntro({ phase }: { phase: number }) {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-8"
      initial={{ opacity: 0, scale: 1.08 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, filter: "blur(10px)" }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0, rotateY: 90 }}
        animate={phase >= 1 ? { y: 0, opacity: 1, rotateY: 0 } : { y: 60, opacity: 0, rotateY: 90 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <AppIcon size={120} />
      </motion.div>

      <motion.h1
        className="font-black text-[clamp(2.5rem,8vw,5.5rem)] tracking-tight"
        style={{ color: GOLD, fontFamily: "'Tajawal', sans-serif", textShadow: `0 0 60px ${GOLD}55` }}
        initial={{ y: 30, opacity: 0 }}
        animate={phase >= 2 ? { y: 0, opacity: 1 } : { y: 30, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        منصة حصاد
      </motion.h1>

      <motion.p
        className="text-[clamp(1.1rem,3vw,2rem)] font-medium"
        style={{
          color: "rgba(255,255,255,0.8)",
          fontFamily: "'Tajawal', sans-serif",
          direction: "rtl",
          filter: phase >= 3 ? "blur(0px)" : "blur(8px)",
          opacity: phase >= 3 ? 1 : 0,
          transition: "all 0.7s ease",
        }}
      >
        تعلم ، نافس، استمتع
      </motion.p>

      <motion.div
        className="text-[clamp(0.9rem,2.2vw,1.4rem)] font-bold px-6 py-2 rounded-full"
        style={{
          color: GOLD,
          border: `1px solid ${GOLD}55`,
          background: `${GOLD}11`,
          fontFamily: "'Tajawal', sans-serif",
          direction: "rtl",
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        حصاد . في جيبك دائماً
      </motion.div>
    </motion.div>
  );
}

function SceneHook({ phase }: { phase: number }) {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center px-[8vw]"
      initial={{ opacity: 0, x: "100vw" }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: "-50vw", scale: 0.85 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      dir="rtl"
    >
      <div className="flex items-center gap-[6vw] w-full">
        <motion.div
          className="flex-1"
          initial={{ opacity: 0, x: 50 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
          transition={{ duration: 0.6 }}
        >
          <h2
            className="font-bold text-[clamp(1.6rem,5vw,3.5rem)] leading-tight mb-6"
            style={{ color: "white", fontFamily: "'Tajawal', sans-serif" }}
          >
            تريد تجربة{" "}
            <span style={{ color: GOLD }}>حصاد</span>
            <br />
            كتطبيق حقيقي؟
          </h2>
          <p
            className="text-[clamp(1rem,2.2vw,1.5rem)] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.7)", fontFamily: "'Tajawal', sans-serif" }}
          >
            ثبّته مجاناً على شاشتك الرئيسية
            <br />
            بدون تنزيل من أي متجر!
          </p>
        </motion.div>

        <motion.div
          className="shrink-0"
          style={{ width: "min(38vw, 280px)", height: "min(65vw, 520px)" }}
          initial={{ opacity: 0, y: 100, rotate: 10 }}
          animate={phase >= 2 ? { opacity: 1, y: 0, rotate: -4 } : { opacity: 0, y: 100, rotate: 10 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          <div
            className="w-full h-full rounded-[2.8rem] overflow-hidden shadow-2xl relative"
            style={{
              background: "#f0f0f0",
              border: "6px solid #1a1a2a",
              boxShadow: "0 40px 100px rgba(0,0,0,0.6)",
            }}
          >
            <div className="h-14 bg-gray-100 border-b border-gray-200 flex items-end justify-center pb-2">
              <div
                className="rounded-lg px-4 py-1.5 text-xs text-gray-500 font-mono"
                style={{ background: "white", border: "1px solid #ddd" }}
              >
                hasadx.com
              </div>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="w-full h-24 rounded-xl" style={{ background: `${GREEN}22` }} />
              <div className="w-3/4 h-4 rounded" style={{ background: "#e0e0e0" }} />
              <div className="w-full h-20 rounded-xl" style={{ background: "#f5f5f5" }} />
              <div className="w-full h-20 rounded-xl" style={{ background: "#f5f5f5" }} />
            </div>
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: `${GREEN}33`, backdropFilter: "blur(4px)" }}
              initial={{ opacity: 0 }}
              animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              <div
                className="flex flex-col items-center gap-3 p-6 rounded-2xl shadow-2xl"
                style={{ background: "white" }}
              >
                <AppIcon size={56} />
                <span style={{ fontSize: 14, fontWeight: 700, color: GREEN, fontFamily: "'Tajawal', sans-serif" }}>
                  حصاد
                </span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function SceneIphone({ phase }: { phase: number }) {
  const steps = [
    { label: "افتح Safari وانتقل إلى hasadx.com", active: phase === 1 },
    { label: 'اضغط زر المشاركة ⤴️ في الشريط السفلي', active: phase === 2 },
    { label: "اختر «أضف للشاشة الرئيسية»", active: phase === 3 },
    { label: "التطبيق جاهز على شاشتك! ✓", active: phase >= 4 },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-between px-[8vw]"
      initial={{ opacity: 0, scale: 1.15 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: "-100vh" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      dir="rtl"
    >
      <div className="flex-1 pr-[4vw]">
        <motion.h2
          className="font-bold text-[clamp(1.8rem,4.5vw,3rem)] mb-8 flex items-center gap-4"
          style={{ color: GOLD, fontFamily: "'Tajawal', sans-serif" }}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          على آيفون
          <svg viewBox="0 0 384 512" width="clamp(28px,3.5vw,44px)" height="clamp(28px,3.5vw,44px)" fill="currentColor" style={{ color: "white" }}>
            <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
          </svg>
        </motion.h2>

        <div className="flex flex-col gap-4">
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              className="flex items-center gap-4 p-4 rounded-2xl transition-all duration-500"
              style={{
                background: step.active ? `${GOLD}18` : phase > idx + 1 ? `${GREEN}18` : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${step.active ? GOLD : phase > idx + 1 ? GREEN : "rgba(255,255,255,0.1)"}`,
              }}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 + 0.3 }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{
                  background: step.active ? GOLD : phase > idx + 1 ? GREEN : "rgba(255,255,255,0.1)",
                  color: step.active || phase > idx + 1 ? "#000" : "rgba(255,255,255,0.4)",
                }}
              >
                {phase > idx + 1 ? "✓" : idx + 1}
              </div>
              <span
                className="text-[clamp(0.85rem,2vw,1.3rem)] font-medium"
                style={{
                  color: step.active ? "white" : phase > idx + 1 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)",
                  fontFamily: "'Tajawal', sans-serif",
                  transition: "color 0.4s",
                }}
              >
                {step.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        className="shrink-0"
        style={{ width: "min(36vw, 270px)", height: "min(64vw, 540px)" }}
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 22, delay: 0.2 }}
      >
        <div
          className="w-full h-full rounded-[2.8rem] overflow-hidden relative"
          style={{
            background: "white",
            border: "6px solid #111",
            boxShadow: "0 40px 100px rgba(0,0,0,0.7)",
          }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-2xl z-30" />

          <motion.div
            className="absolute inset-0 flex flex-col"
            style={{ background: "#f8f8f8" }}
            animate={phase >= 4 ? { opacity: 0, scale: 0.9 } : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="h-16 bg-gray-100 border-b border-gray-200 flex items-end justify-center pb-2 pt-6">
              <div className="rounded-lg px-4 py-1 text-[0.65rem] text-gray-500 font-mono bg-white border border-gray-300">
                hasadx.com
              </div>
            </div>
            <div className="flex-1 p-3 flex flex-col gap-3">
              <div className="w-full h-28 rounded-xl" style={{ background: `${GREEN}15` }} />
              <div className="w-2/3 h-4 rounded bg-gray-200" />
              <div className="w-full h-20 rounded-xl bg-gray-100" />
            </div>
            <div className="h-16 bg-gray-100 border-t border-gray-200 flex justify-around items-center px-6 pb-3">
              <div className="w-7 h-7 rounded-full bg-gray-300" />
              <div className="w-7 h-7 rounded-full bg-gray-300" />
              <div className="relative">
                <motion.div
                  animate={phase === 1 ? { scale: [1, 1.3, 1], color: "#007AFF" } : {}}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2.5">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
                  </svg>
                </motion.div>
                {phase === 1 && (
                  <motion.div
                    className="absolute inset-0 bg-blue-400 rounded-full"
                    initial={{ scale: 0.5, opacity: 0.8 }}
                    animate={{ scale: 3, opacity: 0 }}
                    transition={{ duration: 0.7, repeat: Infinity, repeatDelay: 0.5 }}
                  />
                )}
              </div>
              <div className="w-7 h-7 rounded-full bg-gray-300" />
              <div className="w-7 h-7 rounded-full bg-gray-300" />
            </div>

            <AnimatePresence>
              {phase >= 2 && phase < 4 && (
                <motion.div
                  className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col overflow-hidden"
                  style={{ height: "58%", background: "#f2f2f7", boxShadow: "0 -10px 40px rgba(0,0,0,0.2)" }}
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <div className="w-10 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-3" />
                  <div className="px-3">
                    <div className="bg-white rounded-2xl divide-y divide-gray-100 overflow-hidden">
                      <div className="p-3 flex items-center gap-3">
                        <div className="w-6 h-6 bg-gray-200 rounded" />
                        <div className="h-3 w-28 bg-gray-200 rounded" />
                      </div>
                      <div
                        className="p-3 flex items-center gap-3 relative overflow-hidden"
                        style={{ background: phase === 2 ? "#e8f4ff" : "white" }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        <span className="text-sm font-semibold text-black">أضف للشاشة الرئيسية</span>
                        {phase === 2 && (
                          <motion.div
                            className="absolute left-8 top-3 w-4 h-4 bg-blue-400 rounded-full"
                            initial={{ scale: 0.5, opacity: 0.9 }}
                            animate={{ scale: 8, opacity: 0 }}
                            transition={{ duration: 0.7, delay: 0.4 }}
                          />
                        )}
                      </div>
                      <div className="p-3 flex items-center gap-3">
                        <div className="w-6 h-6 bg-gray-200 rounded" />
                        <div className="h-3 w-20 bg-gray-200 rounded" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div
            className="absolute inset-0 pt-6 px-4"
            style={{ background: "#1a1a2e" }}
            initial={{ opacity: 0 }}
            animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
          >
            <div className="grid grid-cols-4 gap-3 mt-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  {i === 1 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={phase >= 4 ? { scale: 1 } : { scale: 0 }}
                      transition={{ type: "spring", delay: 0.3 }}
                      className="flex flex-col items-center gap-1"
                    >
                      <img src="/icons/icon-192.png" alt="حصاد" style={{ width: 36, height: 36, borderRadius: 8 }} />
                      <span style={{ fontSize: 9, color: "white", fontFamily: "'Tajawal', sans-serif" }}>حصاد</span>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SceneAndroid({ phase }: { phase: number }) {
  const steps = [
    { label: "افتح Chrome وانتقل إلى hasadx.com", active: phase === 1 },
    { label: "اضغط القائمة ⋮ في الزاوية العلوية", active: phase === 2 },
    { label: 'اختر «إضافة إلى الشاشة الرئيسية»', active: phase === 3 },
    { label: "التطبيق جاهز على شاشتك! ✓", active: phase >= 4 },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-between px-[8vw]"
      initial={{ opacity: 0, y: "100vh" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      dir="rtl"
    >
      <div className="flex-1 pr-[4vw]">
        <motion.h2
          className="font-bold text-[clamp(1.8rem,4.5vw,3rem)] mb-8 flex items-center gap-4"
          style={{ color: GOLD, fontFamily: "'Tajawal', sans-serif" }}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          على أندرويد
          <svg viewBox="0 0 576 512" width="clamp(28px,3.5vw,44px)" height="clamp(28px,3.5vw,44px)" fill="white">
            <path d="M420.55,301.93a24,24,0,1,1,24-24,24,24,0,0,1-24,24m-265.1,0a24,24,0,1,1,24-24,24,24,0,0,1-24,24m273.7-144.48,47.94-83a10,10,0,1,0-17.27-10h0l-48.54,84.07a301.25,301.25,0,0,0-246.56,0L116.18,64.45a10,10,0,1,0-17.27,10h0l48,83.17C64.64,202.14,16.79,285.34,0,384H576c-16.79-98.66-64.64-181.86-146.85-226.55" />
          </svg>
        </motion.h2>

        <div className="flex flex-col gap-4">
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              className="flex items-center gap-4 p-4 rounded-2xl transition-all duration-500"
              style={{
                background: step.active ? `${GOLD}18` : phase > idx + 1 ? `${GREEN}18` : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${step.active ? GOLD : phase > idx + 1 ? GREEN : "rgba(255,255,255,0.1)"}`,
              }}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 + 0.3 }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{
                  background: step.active ? GOLD : phase > idx + 1 ? GREEN : "rgba(255,255,255,0.1)",
                  color: step.active || phase > idx + 1 ? "#000" : "rgba(255,255,255,0.4)",
                }}
              >
                {phase > idx + 1 ? "✓" : idx + 1}
              </div>
              <span
                className="text-[clamp(0.85rem,2vw,1.3rem)] font-medium"
                style={{
                  color: step.active ? "white" : phase > idx + 1 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)",
                  fontFamily: "'Tajawal', sans-serif",
                  transition: "color 0.4s",
                }}
              >
                {step.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        className="shrink-0"
        style={{ width: "min(36vw, 270px)", height: "min(64vw, 540px)" }}
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 22, delay: 0.2 }}
      >
        <div
          className="w-full h-full rounded-[2rem] overflow-hidden relative"
          style={{
            background: "white",
            border: "5px solid #222",
            boxShadow: "0 40px 100px rgba(0,0,0,0.7)",
          }}
        >
          <motion.div
            className="absolute inset-0 flex flex-col"
            style={{ background: "#f9f9f9" }}
            animate={phase >= 4 ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-3 pt-1">
              <div className="flex-1 h-8 bg-gray-100 rounded-full flex items-center px-3 text-[0.6rem] text-gray-500 font-mono">
                hasadx.com
              </div>
              <div className="w-8 flex justify-center relative ml-1">
                <motion.div
                  animate={phase === 1 ? { scale: [1, 1.4, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
                  </svg>
                </motion.div>
                {phase === 1 && (
                  <motion.div
                    className="absolute inset-0 bg-gray-400 rounded-full"
                    initial={{ scale: 0.5, opacity: 0.8 }}
                    animate={{ scale: 3, opacity: 0 }}
                    transition={{ duration: 0.7, repeat: Infinity, repeatDelay: 0.5 }}
                  />
                )}
              </div>
            </div>
            <div className="flex-1 p-3 flex flex-col gap-3">
              <div className="w-full h-28 rounded-xl" style={{ background: `${GREEN}15` }} />
              <div className="w-2/3 h-4 rounded bg-gray-200" />
              <div className="w-full h-20 rounded-xl bg-gray-100" />
            </div>

            <AnimatePresence>
              {phase >= 2 && phase < 4 && (
                <motion.div
                  className="absolute top-12 left-2 rounded-xl overflow-hidden shadow-2xl z-20"
                  style={{ background: "white", width: "72%", border: "1px solid #e0e0e0" }}
                  initial={{ opacity: 0, scale: 0.9, transformOrigin: "top left" }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="h-3 w-16 bg-gray-200 rounded" />
                  </div>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="w-5 h-5 bg-gray-200 rounded" />
                    <div className="h-3 w-20 bg-gray-200 rounded" />
                  </div>
                  <div
                    className="px-4 py-3 flex items-center gap-3 relative overflow-hidden"
                    style={{ background: phase === 2 ? "#f0f0f0" : "white" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span className="text-xs font-semibold text-black">إضافة إلى الشاشة الرئيسية</span>
                    {phase === 2 && (
                      <motion.div
                        className="absolute left-8 top-2 w-3 h-3 bg-gray-400 rounded-full"
                        initial={{ scale: 0.5, opacity: 0.9 }}
                        animate={{ scale: 10, opacity: 0 }}
                        transition={{ duration: 0.7, delay: 0.4 }}
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div
            className="absolute inset-0 pt-8 px-4"
            style={{
              background: "linear-gradient(135deg, #1a1a3e, #0d2020)",
            }}
            initial={{ opacity: 0 }}
            animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
          >
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.12)", width: "min(7vw,40px)", height: "min(7vw,40px)" }}
                >
                  {i === 2 && (
                    <motion.div
                      initial={{ scale: 0, y: 20 }}
                      animate={phase >= 4 ? { scale: 1, y: 0 } : { scale: 0, y: 20 }}
                      transition={{ type: "spring", delay: 0.3 }}
                      className="flex flex-col items-center gap-1"
                    >
                      <img src="/icons/icon-192.png" alt="حصاد" style={{ width: "min(6vw,34px)", height: "min(6vw,34px)", borderRadius: 8 }} />
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-10">
              <div className="w-4 h-4 rounded-sm border-2" style={{ borderColor: "rgba(255,255,255,0.5)" }} />
              <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: "rgba(255,255,255,0.5)" }} />
              <div className="w-4 h-4 rotate-45 border-2" style={{ borderColor: "rgba(255,255,255,0.5)" }} />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SceneOutro({ phase }: { phase: number }) {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <div className="flex gap-10 items-end">
        {[
          { label: "iPhone", color: "#111", radius: "2.5rem", rotate: -5 },
          { label: "Android", color: "#1a1a2e", radius: "1.8rem", rotate: 5 },
        ].map((phone, idx) => (
          <motion.div
            key={idx}
            initial={{ y: 60, opacity: 0 }}
            animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 22, delay: idx * 0.2 + 0.2 }}
            style={{ rotate: phone.rotate }}
          >
            <div
              style={{
                width: "min(28vw, 180px)",
                height: "min(50vw, 340px)",
                background: phone.color,
                borderRadius: phone.radius,
                border: `3px solid ${GOLD}66`,
                boxShadow: `0 30px 70px rgba(0,0,0,0.6), 0 0 40px ${GOLD}22`,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                paddingTop: 28,
                gap: 16,
              }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={phase >= 2 ? { scale: 1 } : { scale: 0 }}
                transition={{ type: "spring", delay: 0.5 + idx * 0.15 }}
              >
                <div className="relative">
                  <AppIcon size={56} />
                  <motion.div
                    className="absolute inset-0 rounded-xl"
                    style={{ background: GOLD, borderRadius: "12px" }}
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 1.8, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                </div>
              </motion.div>
              <motion.span
                style={{ fontSize: 12, color: "white", fontFamily: "'Tajawal', sans-serif", fontWeight: 600 }}
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: 0.7 + idx * 0.1 }}
              >
                {phone.label}
              </motion.span>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.h2
        className="font-black text-[clamp(2rem,5.5vw,4rem)] text-center"
        style={{ color: GOLD, fontFamily: "'Tajawal', sans-serif", textShadow: `0 0 50px ${GOLD}66` }}
        initial={{ y: 20, opacity: 0 }}
        animate={phase >= 2 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
        transition={{ delay: 0.8, type: "spring" }}
      >
        حصاد . جاهز الآن
      </motion.h2>

      <motion.p
        className="text-[clamp(1rem,2.5vw,1.6rem)] font-medium"
        style={{ color: "rgba(255,255,255,0.75)", fontFamily: "'Tajawal', sans-serif" }}
        initial={{ opacity: 0 }}
        animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 0.2 }}
      >
        تعلم ، نافس، استمتع
      </motion.p>

      <motion.div
        className="px-7 py-3 rounded-2xl font-mono tracking-wider text-[clamp(0.8rem,1.8vw,1.1rem)]"
        style={{
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(10px)",
          border: `1px solid ${GREEN}66`,
          color: GOLD,
        }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={phase >= 3 ? { scale: 1, opacity: 1 } : { scale: 0.9, opacity: 0 }}
        transition={{ delay: 0.4, type: "spring" }}
      >
        hasadx.com
      </motion.div>
    </motion.div>
  );
}

export default function InstallTutorial() {
  const [currentSceneIdx, setCurrentSceneIdx] = useState(() => {
    if (typeof window === "undefined") return 0;
    const params = new URLSearchParams(window.location.search);
    const start = parseInt(params.get("start") || "0", 10);
    if (Number.isFinite(start) && start >= 0 && start < SCENES.length) return start;
    return 0;
  });
  const [phase, setPhase] = useState(0);

  const currentScene = SCENES[currentSceneIdx];

  useEffect(() => {
    setPhase(0);
    const timers: ReturnType<typeof setTimeout>[] = [];

    const schedules: Record<Scene, number[]> = {
      intro: [300, 1000, 2000],
      hook: [300, 1500],
      iphone: [500, 2200, 4400, 6200],
      android: [500, 2200, 4400, 6200],
      outro: [500, 1500, 2800],
    };

    schedules[currentScene].forEach((t, i) => {
      timers.push(setTimeout(() => setPhase(i + 1), t));
    });

    timers.push(
      setTimeout(() => {
        setCurrentSceneIdx((prev) => (prev + 1) % SCENES.length);
      }, DURATIONS[currentScene])
    );

    return () => timers.forEach(clearTimeout);
  }, [currentSceneIdx]);

  return (
    <div
      className="tutorial-page relative w-full overflow-hidden"
      style={{
        height: "100vh",
        background: "linear-gradient(135deg, #071510 0%, #0b1f18 45%, #10180a 100%)",
        fontFamily: "'Tajawal', 'IBM Plex Sans Arabic', sans-serif",
      }}
    >
      <style>{`
        .tutorial-page,
        .tutorial-page * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
          font-feature-settings: "kern" 1, "calt" 1, "liga" 1, "ss01" 1;
        }
        .tutorial-page h1, .tutorial-page h2 {
          font-family: 'Tajawal', 'IBM Plex Sans Arabic', sans-serif !important;
          font-weight: 900 !important;
          letter-spacing: -0.02em;
          line-height: 1.05;
        }
        .tutorial-page h3 {
          font-family: 'Tajawal', 'IBM Plex Sans Arabic', sans-serif !important;
          font-weight: 800 !important;
          letter-spacing: -0.015em;
          line-height: 1.15;
        }
        .tutorial-page p {
          font-family: 'IBM Plex Sans Arabic', 'Tajawal', sans-serif !important;
          font-weight: 400;
          letter-spacing: -0.005em;
          line-height: 1.55;
        }
        .tutorial-page .step-text {
          font-family: 'IBM Plex Sans Arabic', sans-serif !important;
          font-weight: 600;
          letter-spacing: -0.01em;
          line-height: 1.45;
        }
        .tutorial-page .url-bar {
          font-family: 'IBM Plex Sans Arabic', 'Tajawal', sans-serif !important;
          font-weight: 500;
          letter-spacing: 0.01em;
          font-feature-settings: "tnum" 1;
        }
        .tutorial-page .brand-display {
          font-family: 'Tajawal', sans-serif !important;
          font-weight: 900 !important;
          letter-spacing: -0.035em;
          line-height: 0.95;
        }
        .tutorial-page .pill-text {
          font-family: 'IBM Plex Sans Arabic', sans-serif !important;
          font-weight: 600;
          letter-spacing: 0.005em;
        }
      `}</style>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 25% 20%, rgba(45,106,79,0.2) 0%, transparent 55%), radial-gradient(ellipse at 75% 80%, rgba(196,149,24,0.12) 0%, transparent 50%)",
        }}
      />

      <Background />

      <ProgressBars current={currentSceneIdx} total={SCENES.length} duration={DURATIONS[currentScene]} />

      <div className="absolute inset-0 z-10">
        <AnimatePresence mode="popLayout">
          {currentScene === "intro" && <SceneIntro key="intro" phase={phase} />}
          {currentScene === "hook" && <SceneHook key="hook" phase={phase} />}
          {currentScene === "iphone" && <SceneIphone key="iphone" phase={phase} />}
          {currentScene === "android" && <SceneAndroid key="android" phase={phase} />}
          {currentScene === "outro" && <SceneOutro key="outro" phase={phase} />}
        </AnimatePresence>
      </div>

      <NavDots current={currentSceneIdx} total={SCENES.length} onSelect={setCurrentSceneIdx} />
    </div>
  );
}
