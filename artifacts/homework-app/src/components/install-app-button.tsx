import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Smartphone, ArrowLeft, ArrowRight, X, BookOpen, ExternalLink } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";

type Variant = "hero" | "compact" | "card";

interface Props {
  variant?: Variant;
  className?: string;
}

const IOS_ICON = (
  <svg viewBox="0 0 384 512" className="w-5 h-5" fill="currentColor">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);

const ANDROID_ICON = (
  <svg viewBox="0 0 576 512" className="w-5 h-5" fill="currentColor">
    <path d="M420.55,301.93a24,24,0,1,1,24-24,24,24,0,0,1-24,24m-265.1,0a24,24,0,1,1,24-24,24,24,0,0,1-24,24m273.7-144.48,47.94-83a10,10,0,1,0-17.27-10h0l-48.54,84.07a301.25,301.25,0,0,0-246.56,0L116.18,64.45a10,10,0,1,0-17.27,10h0l48,83.17C64.64,202.14,16.79,285.34,0,384H576c-16.79-98.66-64.64-181.86-146.85-226.55" />
  </svg>
);

function InstallModal({ onClose }: { onClose: () => void }) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [androidInstalled, setAndroidInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleAndroidDirectInstall = async () => {
    if (installPrompt) {
      (installPrompt as any).prompt?.();
      const result = await (installPrompt as any).userChoice?.catch(() => null);
      if (result?.outcome === "accepted") {
        setAndroidInstalled(true);
        setTimeout(onClose, 1500);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        dir={isAr ? "rtl" : "ltr"}
        style={{ background: "hsl(145,30%,10%)", border: "1px solid hsl(145,25%,18%)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <img src="/icons/icon-192.png" alt="حصاد" className="w-10 h-10 rounded-2xl shadow-md" />
            <div>
              <p className="font-black text-white text-base leading-tight">
                {isAr ? "ثبّت حصاد" : "Install Hasad"}
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                {isAr ? "بدون متجر تطبيقات" : "No app store needed"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-3">
          {isInstalled ? (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: "hsl(145,55%,18%)", border: "1px solid hsl(145,55%,28%)" }}
            >
              <span className="text-2xl">✅</span>
              <p className="font-bold text-white text-sm">
                {isAr ? "التطبيق مثبّت بالفعل!" : "App is already installed!"}
              </p>
            </div>
          ) : (
            <>
              {/* Android direct install */}
              {installPrompt && (
                <button
                  onClick={handleAndroidDirectInstall}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-white transition-all active:scale-95"
                  style={{ background: androidInstalled ? "hsl(145,50%,22%)" : "hsl(145,55%,28%)", border: "1px solid hsl(145,55%,38%)" }}
                >
                  <span style={{ color: "#3DDC84" }}>{ANDROID_ICON}</span>
                  <span className="flex-1 text-start">
                    <span className="block font-black">
                      {androidInstalled ? (isAr ? "تم التثبيت ✓" : "Installed ✓") : (isAr ? "تثبيت مباشر — Android" : "Install directly — Android")}
                    </span>
                    <span className="block text-xs font-normal mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                      {isAr ? "اضغط لتثبيته الآن بنقرة واحدة" : "One tap to install now"}
                    </span>
                  </span>
                </button>
              )}

              {/* iOS instructions */}
              <Link
                href="/install?device=iphone"
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-white transition-all active:scale-95"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <span className="text-white/80">{IOS_ICON}</span>
                <span className="flex-1 text-start">
                  <span className="block font-black">
                    {isAr ? "تثبيت على iPhone / iPad" : "Install on iPhone / iPad"}
                  </span>
                  <span className="block text-xs font-normal mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {isAr ? "عبر Safari ← مشاركة ← إضافة للشاشة الرئيسية" : "Safari → Share → Add to Home Screen"}
                  </span>
                </span>
                <ArrowLeft className="w-3.5 h-3.5 text-white/30 shrink-0" />
              </Link>

              {/* Android guide (when no prompt — e.g. already dismissed) */}
              {!installPrompt && (
                <Link
                  href="/install?device=android"
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-white transition-all active:scale-95"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <span style={{ color: "#3DDC84" }}>{ANDROID_ICON}</span>
                  <span className="flex-1 text-start">
                    <span className="block font-black">
                      {isAr ? "تثبيت على Android" : "Install on Android"}
                    </span>
                    <span className="block text-xs font-normal mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {isAr ? "Chrome ← القائمة ← إضافة للشاشة الرئيسية" : "Chrome → Menu → Add to Home Screen"}
                    </span>
                  </span>
                  <ArrowLeft className="w-3.5 h-3.5 text-white/30 shrink-0" />
                </Link>
              )}
            </>
          )}

          {/* Tutorial link */}
          <div className="pt-1">
            <div className="h-px mb-3" style={{ background: "rgba(255,255,255,0.07)" }} />
            <Link
              href="/install"
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95"
              style={{ color: "rgba(255,255,255,0.5)", background: "transparent" }}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span className="flex-1">{isAr ? "دليل التثبيت الكامل (خطوة بخطوة)" : "Full install guide (step by step)"}</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function InstallAppButton({ variant = "compact", className = "" }: Props) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const Arrow = isAr ? ArrowLeft : ArrowRight;
  const [open, setOpen] = useState(false);

  if (variant === "hero") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className={`group inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/70 hover:bg-white border border-[hsl(145,20%,82%)] hover:border-[hsl(43,74%,49%)]/45 text-[hsl(145,30%,28%)] hover:text-[hsl(145,40%,20%)] transition-colors duration-200 ${className}`}
        >
          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[hsl(43,85%,55%)]/15 text-[hsl(43,74%,38%)] shrink-0">
            <Smartphone className="w-3.5 h-3.5" strokeWidth={2.4} />
          </span>
          <span className="text-start leading-tight">
            <span className="block font-semibold text-[13px] tracking-tight">
              {isAr ? "ثبّت حصاد على هاتفك" : "Install Hasad on your phone"}
            </span>
            <span className="block text-[11px] text-[hsl(145,15%,50%)] font-normal mt-0.5">
              {isAr ? "وصول أسرع بنقرة واحدة" : "One tap away — anytime"}
            </span>
          </span>
          <Arrow className="hidden sm:block w-3.5 h-3.5 text-[hsl(145,20%,55%)] shrink-0 group-hover:text-[hsl(43,74%,42%)] group-hover:translate-x-0.5 transition-all" />
        </button>

        <AnimatePresence>
          {open && <InstallModal onClose={() => setOpen(false)} />}
        </AnimatePresence>
      </>
    );
  }

  if (variant === "card") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className={`group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-white to-[hsl(43,74%,97%)] border border-[hsl(43,74%,49%)]/25 hover:border-[hsl(43,74%,49%)]/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 w-full text-start ${className}`}
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(43,90%,55%)] to-[hsl(38,80%,48%)] shadow-md shrink-0">
            <Smartphone className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-[hsl(145,40%,18%)] tracking-tight">
              {isAr ? "ثبّت حصاد كتطبيق" : "Install Hasad as an app"}
            </div>
            <div className="text-xs text-[hsl(145,20%,42%)] mt-0.5">
              {isAr ? "iOS وأندرويد — بدون متجر" : "iOS & Android — no store needed"}
            </div>
          </div>
          <Arrow className="w-4 h-4 text-[hsl(43,74%,42%)] shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <AnimatePresence>
          {open && <InstallModal onClose={() => setOpen(false)} />}
        </AnimatePresence>
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={isAr ? "ثبّت التطبيق على هاتفك" : "Install on your phone"}
        className={`group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[hsl(43,74%,49%)]/40 hover:border-[hsl(43,74%,49%)] text-[hsl(145,40%,20%)] hover:text-[hsl(43,74%,32%)] font-semibold text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${className}`}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-[hsl(43,90%,55%)] to-[hsl(38,80%,48%)]">
          <Smartphone className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
        </span>
        <span className="tracking-tight">
          {isAr ? "ثبّت كتطبيق" : "Install App"}
        </span>
      </button>

      <AnimatePresence>
        {open && <InstallModal onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
