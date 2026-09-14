import { motion } from "framer-motion";
import styles from "./wameeth-launch.module.css";

interface WameethLaunchProps {
  status?: "idle" | "checking" | "found" | "error";
  variant?: "compact" | "large";
  title?: string;
}

export function WameethLaunch({ status = "idle", variant = "compact", title = "وميض" }: WameethLaunchProps) {
  return (
    <div
      className={`${styles.launchContainer} ${styles[`variant-${variant}`]} ${styles[`status-${status}`]}`}
      aria-hidden="true"
    >
      <div className={styles.scene}>
        <div className={styles.glowBackdrop} />

        <div className={`${styles.speedWing} ${styles.speedWingStart}`}>
          <span />
          <span />
          <span />
        </div>
        <div className={`${styles.speedWing} ${styles.speedWingEnd}`}>
          <span />
          <span />
          <span />
        </div>

        <motion.div
          className={styles.typographyContainer}
          initial={{ opacity: 0, scale: 0.88, filter: "blur(8px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className={styles.lightWash} />
          <h2 className={styles.titleText}>{title}</h2>
        </motion.div>

        <div className={styles.speedCutsStart}><span /><span /></div>
        <div className={styles.speedCutsEnd}><span /><span /></div>
      </div>
    </div>
  );
}
