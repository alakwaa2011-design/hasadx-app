import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share, PlusSquare, Download, Compass, Smartphone, MonitorDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from "@/components/ui/dialog";
import { useQuranInstall, useQuranInstallCooldown } from "./use-quran-install";

export function QuranInstallExperience({
  standalone,
  isPlaying,
  isDockOpen,
  manualOpen,
  onManualOpenChange,
}: {
  standalone: boolean;
  isPlaying: boolean;
  isDockOpen: boolean;
  manualOpen: boolean;
  onManualOpenChange: (open: boolean) => void;
}) {
  const { platform, promptInstall, isInstallable } = useQuranInstall();
  const { isDismissed, dismiss } = useQuranInstallCooldown();
  const [smartVisible, setSmartVisible] = useState(false);
  const { lang, dir } = useI18n();

  useEffect(() => {
    if (!standalone || !isInstallable || isDismissed || (platform !== "native" && platform !== "ios-safari")) {
      setSmartVisible(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setSmartVisible(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, [standalone, isInstallable, isDismissed, platform]);

  useEffect(() => {
    if (isPlaying || isDockOpen) setSmartVisible(false);
  }, [isDockOpen, isPlaying]);

  const showSmart = smartVisible && !isPlaying && !isDockOpen;

  const handleInstallClick = async () => {
    if (platform === "native") {
      const outcome = await promptInstall();
      if (outcome === "accepted") {
        setSmartVisible(false);
        onManualOpenChange(false);
      }
    } else {
      setSmartVisible(false);
      onManualOpenChange(true);
    }
  };

  const handleDismiss = () => {
    dismiss();
    setSmartVisible(false);
  };

  if (!standalone) return null;

  return (
    <>
      <AnimatePresence>
        {showSmart && !manualOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-0 right-0 z-50 mx-auto flex w-[calc(100%-2rem)] max-w-[22rem] flex-row items-center gap-3.5 rounded-[1.25rem] bg-[#123D2E] p-3 text-white shadow-[0_20px_40px_-15px_rgba(18,61,46,0.6)] ring-1 ring-white/10"
            dir={dir}
          >
            <img src="/icons/quran-hasaad.png" alt="" className="h-11 w-11 shrink-0" />
            <div className="flex-1">
              <h3 className="text-[13px] font-bold leading-tight">
                {lang === "ar" ? "تجربة قراءة أفضل" : "Better Reading Experience"}
              </h3>
              <p className="mt-0.5 text-[11px] text-emerald-100/70 line-clamp-1">
                {lang === "ar"
                  ? "ثبّت المصحف ليبقى قريبًا منك"
                  : "Install the Quran for quicker access"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 pr-1 rtl:pr-0 rtl:pl-1">
              <button
                onClick={handleInstallClick}
                className="rounded-lg bg-emerald-500/20 px-3.5 py-1.5 text-xs font-bold text-emerald-50 hover:bg-emerald-500/30 transition-colors active:scale-95"
              >
                {lang === "ar" ? "تثبيت" : "Install"}
              </button>
              <button
                onClick={handleDismiss}
                className="flex h-8 w-8 items-center justify-center rounded-full text-emerald-200/50 hover:bg-white/10 hover:text-white transition-colors active:scale-95"
                aria-label={lang === "ar" ? "إغلاق" : "Close"}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={manualOpen} onOpenChange={onManualOpenChange}>
        <DialogContent className="sm:max-w-md bg-[#F8F1DF] dark:bg-[#0a0c0b] border-emerald-900/10 dark:border-emerald-100/10 shadow-2xl">
          <DialogHeader className="pt-2">
            <DialogTitle className="text-emerald-950 dark:text-emerald-50 flex items-center gap-3">
              <img src="/icons/quran-hasaad.png" alt="" className="h-8 w-8 shrink-0" />
              {lang === "ar" ? "تثبيت مصحف حصاد" : "Install Hasaad Quran"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {lang === "ar" ? "تعليمات تثبيت التطبيق" : "App installation instructions"}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex flex-col gap-6" dir={dir}>
            {platform === "ios-safari" && (
              <div className="flex flex-col gap-4">
                <p className="text-[13px] leading-relaxed text-stone-600 dark:text-stone-400">
                  {lang === "ar"
                    ? "للوصول إلى المصحف مباشرة، أضف التطبيق إلى شاشتك الرئيسية:"
                    : "For direct access to the Quran, add the app to your home screen:"}
                </p>
                <div className="flex flex-col gap-0 rounded-2xl bg-white dark:bg-[#121413] shadow-sm ring-1 ring-stone-950/5 dark:ring-white/5 overflow-hidden">
                  <div className="flex items-center gap-4 p-4 border-b border-stone-950/5 dark:border-white/5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-50 dark:bg-stone-800/50 text-blue-500">
                      <Share className="h-5 w-5" />
                    </div>
                    <p className="text-[13px] font-bold text-stone-700 dark:text-stone-300">
                      {lang === "ar" ? "١. اضغط على زر المشاركة" : "1. Tap the Share button"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-50 dark:bg-stone-800/50 text-stone-700 dark:text-stone-300">
                      <PlusSquare className="h-5 w-5" />
                    </div>
                    <p className="text-[13px] font-bold text-stone-700 dark:text-stone-300">
                      {lang === "ar"
                        ? "٢. اختر «إضافة للشاشة الرئيسية»"
                        : "2. Select 'Add to Home Screen'"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {platform === "ios-inapp" && (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 p-5 ring-1 ring-amber-500/20">
                  <div className="flex items-center gap-3 text-amber-800 dark:text-amber-200 mb-3">
                    <Compass className="h-5 w-5" />
                    <span className="font-bold text-sm">
                      {lang === "ar" ? "افتح في متصفح سفاري" : "Open in Safari"}
                    </span>
                  </div>
                  <p className="text-[13px] text-amber-700/80 dark:text-amber-300/80 leading-relaxed">
                    {lang === "ar"
                      ? "أنت تتصفح من داخل تطبيق آخر. لتثبيت المصحف، يرجى فتح الرابط في متصفح سفاري أولاً عبر القائمة أعلاه."
                      : "You are browsing from within another app. To install the Quran, please open the link in Safari first via the menu above."}
                  </p>
                </div>
              </div>
            )}

            {platform === "native" && (
              <div className="flex flex-col items-center justify-center gap-5 py-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-emerald-100 dark:bg-[#123D2E]/50 text-[#123D2E] dark:text-emerald-400 ring-1 ring-[#123D2E]/10">
                  <Download className="h-8 w-8" />
                </div>
                <p className="text-center text-[13px] text-stone-600 dark:text-stone-400">
                  {lang === "ar"
                    ? "ثبّت مصحف حصاد مباشرة على جهازك لتصل إليه بسرعة من شاشتك الرئيسية."
                    : "Install Hasaad Quran directly for quick access from your home screen."}
                </p>
                <button
                  onClick={async () => {
                    const outcome = await promptInstall();
                    if (outcome === "accepted") onManualOpenChange(false);
                  }}
                  className="mt-2 w-full rounded-xl bg-[#123D2E] px-4 py-3.5 text-sm font-bold text-white hover:bg-[#18533e] transition-colors active:scale-[0.98]"
                >
                  {lang === "ar" ? "تثبيت التطبيق الآن" : "Install App Now"}
                </button>
              </div>
            )}
            {(platform === "desktop" || platform === "app-window") && (
              <div className="flex flex-col items-center gap-4 py-3">
                <MonitorDown className="h-10 w-10 text-emerald-800 dark:text-emerald-300" />
                <p className="text-center text-[13px] leading-relaxed text-stone-700 dark:text-stone-300">
                  {platform === "app-window"
                    ? (lang === "ar"
                      ? "أنت داخل نافذة تطبيق حصاد المثبّت. لتثبيت المصحف كتطبيق مستقل، انسخ الرابط وافتحه مباشرة في متصفح Chrome أو Edge خارج نافذة حصاد."
                      : "You are in an installed app window. To install the Quran separately, copy the link and open it in Chrome or Edge outside the Hasaad app.")
                    : (lang === "ar"
                      ? "افتح الصفحة في Chrome أو Edge، ثم اضغط أيقونة التثبيت في شريط العنوان أو اختر «تثبيت الصفحة كتطبيق» من قائمة المتصفح."
                      : "Open this page in Chrome or Edge, then use the install icon in the address bar or choose “Install page as app” from the browser menu.")}
                </p>
                <a href="/quran" target="_blank" rel="noopener noreferrer" className="break-all text-center text-xs text-emerald-700 underline dark:text-emerald-300">
                  {window.location.origin}/quran
                </a>
                {platform === "app-window" && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`${window.location.origin}/quran`);
                        toast.success(lang === "ar" ? "تم نسخ رابط المصحف" : "Quran link copied");
                      } catch {
                        toast.error(lang === "ar" ? "تعذر النسخ؛ حدد الرابط وانسخه يدويًا" : "Copy failed; select and copy the link manually");
                      }
                    }}
                    className="rounded-xl bg-[#123D2E] px-4 py-2.5 text-xs font-bold text-white"
                  >
                    {lang === "ar" ? "نسخ رابط المصحف" : "Copy Quran link"}
                  </button>
                )}
              </div>
            )}
            
            {platform === "unsupported" && (
              <div className="flex flex-col items-center justify-center gap-5 py-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-stone-100 dark:bg-stone-800/50 text-stone-400 ring-1 ring-stone-950/5">
                  <Smartphone className="h-8 w-8" />
                </div>
                <p className="text-center text-[13px] leading-relaxed text-stone-600 dark:text-stone-400 max-w-[260px]">
                  {lang === "ar"
                    ? "المتصفح الحالي لا يدعم التثبيت المباشر. حاول استخدام متصفح حديث مثل سفاري أو كروم."
                    : "Your current browser doesn't support direct installation. Try using a modern browser like Safari or Chrome."}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
