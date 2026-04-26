import { useMemo } from "react";
import { motion } from "framer-motion";

interface CoinRainProps {
  count?: number;
  durationSec?: number;
}

export function CoinRain({ count = 60, durationSec = 6 }: CoinRainProps) {
  const coins = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * durationSec * 0.6,
      duration: 2.5 + Math.random() * 2.5,
      size: 22 + Math.random() * 22,
      rot: (Math.random() - 0.5) * 720,
      drift: (Math.random() - 0.5) * 80,
    })),
    [count, durationSec]
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      {coins.map(c => (
        <motion.div
          key={c.id}
          initial={{ y: -80, x: 0, rotate: 0, opacity: 0 }}
          animate={{
            y: typeof window !== "undefined" ? window.innerHeight + 80 : 1000,
            x: c.drift,
            rotate: c.rot,
            opacity: [0, 1, 1, 0.9],
          }}
          transition={{ delay: c.delay, duration: c.duration, ease: "easeIn" }}
          style={{
            position: "absolute",
            top: 0,
            left: `${c.left}%`,
            width: c.size,
            height: c.size,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: "radial-gradient(circle at 30% 30%, #fde68a 0%, #f59e0b 55%, #b45309 100%)",
              boxShadow: "0 0 12px rgba(251,191,36,0.7), inset 0 0 6px rgba(120,53,15,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#7c2d12",
              fontWeight: 900,
              fontSize: c.size * 0.5,
              fontFamily: "serif",
              lineHeight: 1,
            }}
          >
            $
          </div>
        </motion.div>
      ))}
    </div>
  );
}
