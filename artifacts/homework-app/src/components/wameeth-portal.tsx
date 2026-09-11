import { motion } from "framer-motion";
import styles from "./wameeth-portal.module.css";

interface WameethPortalProps {
  pinLength: number;
  status: "idle" | "checking" | "found" | "error";
}

export function WameethPortal({ pinLength, status }: WameethPortalProps) {
  // Map 0-6 length to 0-1 progress
  const progress = Math.min(pinLength / 6, 1);
  const circumference = 276.46; // 2 * PI * r (where r = 44)

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0, rotateX: 20 }}
      animate={{ scale: 1, opacity: 1, rotateX: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className={`${styles.portalContainer} ${styles[`status-${status}`]}`}
      aria-hidden="true"
    >
      <div className={styles.ambientFloat}>
        {/* Intense cinematic glow behind the core */}
        <div className={styles.glowBase} />

        {/* Layer 1: Ambient Outer Tech Ring */}
        <svg className={`${styles.ring} ${styles.ambientRight}`} viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="48" strokeWidth="1" strokeDasharray="4 6" className={styles.accentPath} opacity="0.3" />
          <circle cx="50" cy="50" r="48" strokeWidth="1.5" strokeDasharray="30 90" className={styles.accentPath} strokeLinecap="round" opacity="0.7" />
        </svg>

        {/* Layer 2: Interactive PIN Progress Ring */}
        <svg className={styles.ring} viewBox="0 0 100 100" fill="none" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="50" cy="50" r="44" strokeWidth="1.5" stroke="rgba(123,243,178,0.1)" />
          <motion.circle
            cx="50" cy="50" r="44"
            strokeWidth="2.5"
            className={styles.ringPath}
            strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${progress * circumference} ${circumference}` }}
            transition={{ type: "spring", bounce: 0, duration: 0.5 }}
          />
        </svg>

        {/* Layer 3: Rub el Hizb (8-point star base frame) */}
        <svg className={`${styles.ring} ${styles.ambientLeft}`} viewBox="0 0 100 100" fill="none">
          <g className={styles.ringPath} strokeWidth="1" opacity="0.6">
            <rect x="23" y="23" width="54" height="54" rx="2" />
            <rect x="23" y="23" width="54" height="54" rx="2" transform="rotate(45 50 50)" />
          </g>
        </svg>

        {/* Layer 4: The Dimensional Core */}
        <svg className={styles.ring} viewBox="0 0 100 100" fill="none">
          <motion.g
            className={styles.coreGroup}
            animate={{
              scale: status === "found" ? 1.2 : (0.9 + progress * 0.1),
              rotate: status === "found" ? 45 : (status === "checking" ? 180 : 0)
            }}
            transition={{ type: "spring", stiffness: status === "found" ? 300 : 200, damping: 20 }}
            style={{ transformOrigin: '50px 50px' }}
          >
            {/* Inner technical boundary */}
            <circle cx="50" cy="50" r="21" strokeWidth="1" className={styles.ringPath} strokeDasharray="2 4" opacity="0.8" />

            {/* Solid Core Jewel */}
            <path
              d="M50 32 L68 50 L50 68 L32 50 Z"
              className={`${styles.coreFill} ${styles.ringPath}`}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />

            {/* Inner Facets for depth */}
            <path
              d="M50 32 L50 68 M32 50 L68 50"
              className={styles.accentPath}
              strokeWidth="0.75"
              opacity="0.6"
            />

            {/* Center spark */}
            <circle cx="50" cy="50" r="3.5" className={styles.accentPath} fill="currentColor" />
          </motion.g>
        </svg>
      </div>
    </motion.div>
  );
}
