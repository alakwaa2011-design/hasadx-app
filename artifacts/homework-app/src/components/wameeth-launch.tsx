import { motion } from "framer-motion";
import styles from "./wameeth-launch.module.css";

interface WameethLaunchProps {
  status?: "idle" | "checking" | "found" | "error";
  variant?: "compact" | "large";
}

export function WameethLaunch({ status = "idle", variant = "compact" }: WameethLaunchProps) {
  const isLarge = variant === "large";
  
  return (
    <div className={`${styles.launchContainer} ${styles[`variant-${variant}`]} ${styles[`status-${status}`]}`} aria-hidden="true">
      <div className={styles.scene}>
        {/* Layer 1: Ambient deep glow */}
        <div className={styles.glowBackdrop} />

        {/* Layer 2: Fast horizontal light streaks (race/action) */}
        <div className={styles.streaksContainer}>
          <div className={styles.streakTop} />
          <div className={styles.streakMiddle} />
          <div className={styles.streakBottom} />
        </div>

        {/* Layer 3: Main typographic centerpiece */}
        <motion.div 
          className={styles.typographyContainer}
          initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Animated Gold/Sheen Text */}
          <h2 className={styles.titleText}>
            وميض الانطلاق
          </h2>
        </motion.div>
      </div>
    </div>
  );
}
