import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import QRCode from "react-qr-code";
import { Copy, Check, ArrowRight, ArrowLeft, Smartphone } from "lucide-react";

const GOLD = "hsl(43,74%,49%)";
const GREEN = "hsl(145,55%,32%)";
const GOLD_LIGHT = "hsl(43,85%,58%)";

type Device = "iphone" | "android";

function detectDevice(): Device {
  if (typeof navigator === "undefined") return "iphone";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iphone";
  return "iphone";
}

const IOS_STEPS = [
  {
    num: 1,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
    title: "افتح Safari",
    desc: "تأكد من استخدام متصفح Safari وليس Chrome أو غيره",
  },
  {
    num: 2,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
      </svg>
    ),
    title: 'اضغط زر المشاركة ⬆',
    desc: 'زر السهم المتجه للأعلى في شريط الأدوات السفلي',
  },
  {
    num: 3,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
    title: "أضف للشاشة الرئيسية",
    desc: "ابحث عن «أضف إلى الشاشة الرئيسية» في القائمة واضغط عليها",
  },
  {
    num: 4,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
    title: "اضغط «إضافة»",
    desc: "ستظهر أيقونة حصاد على شاشتك الرئيسية مباشرة",
  },
];

const ANDROID_STEPS = [
  {
    num: 1,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
    title: "افتح Chrome",
    desc: "افتح هذه الصفحة في متصفح Chrome على جهاز Android",
  },
  {
    num: 2,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
        <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
      </svg>
    ),
    title: "افتح القائمة ⋮",
    desc: "اضغط على النقاط الثلاث في الزاوية العلوية اليمنى",
  },
  {
    num: 3,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
        <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
      </svg>
    ),
    title: "إضافة إلى الشاشة الرئيسية",
    desc: "اختر «إضافة إلى الشاشة الرئيسية» من القائمة",
  },
  {
    num: 4,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
    title: "تأكيد التثبيت",
    desc: "اضغط «إضافة» لتثبيت حصاد على شاشتك الرئيسية",
  },
];

export default function InstallPage() {
  const [device, setDevice] = useState<Device>("iphone");
  const [copied, setCopied] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  const installUrl = `${window.location.origin}${import.meta.env.BASE_URL}install`;

  useEffect(() => {
    // Respect ?device= query param from install modal links, otherwise auto-detect
    const params = new URLSearchParams(window.location.search);
    const qd = params.get("device");
    if (qd === "iphone" || qd === "android") {
      setDevice(qd);
    } else {
      setDevice(detectDevice());
    }

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

  const handleAndroidInstall = () => {
    if (installPrompt) {
      (installPrompt as any).prompt?.();
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(installUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const steps = device === "iphone" ? IOS_STEPS : ANDROID_STEPS;
  const isAr = true;

  return (
    <div
      className="min-h-screen flex flex-col"
      dir="rtl"
      style={{
        background: "linear-gradient(160deg, hsl(145,40%,8%) 0%, hsl(145,30%,12%) 40%, hsl(43,40%,10%) 100%)",
        fontFamily: "'Tajawal', 'Noto Sans Arabic', sans-serif",
      }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-bold rounded-xl px-3 py-2 transition-colors"
          style={{ color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.06)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          الرئيسية
        </Link>

        <div className="flex items-center gap-2">
          <img src="/icons/icon-192.png" alt="حصاد" className="w-8 h-8 rounded-xl shadow-md" />
          <span className="font-black text-lg tracking-tight" style={{ color: GOLD_LIGHT }}>حصاد</span>
        </div>
      </header>

      <main className="flex-1 px-5 pb-10 max-w-md mx-auto w-full">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-6"
        >
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl shadow-2xl mb-4"
            style={{ background: `linear-gradient(135deg, ${GOLD} 0%, hsl(38,80%,42%) 100%)` }}
          >
            <img src="/icons/icon-192.png" alt="حصاد" className="w-14 h-14 rounded-2xl" />
          </motion.div>

          <h1 className="font-black text-3xl text-white mb-2 tracking-tight">ثبّت تطبيق حصاد</h1>
          <p className="text-base font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
            مجاناً بدون متجر تطبيقات — مباشرة على شاشتك
          </p>
        </motion.div>

        {/* Already installed banner */}
        {isInstalled && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-5 flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{ background: `${GREEN}30`, border: `1px solid ${GREEN}60` }}
          >
            <Check className="w-5 h-5 shrink-0" style={{ color: "hsl(145,65%,55%)" }} />
            <div>
              <p className="font-bold text-white text-sm">التطبيق مثبّت بالفعل ✓</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>يمكنك فتح حصاد من شاشتك الرئيسية</p>
            </div>
          </motion.div>
        )}

        {/* Device Tabs */}
        <div className="flex gap-2 mb-6 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.07)" }}>
          {(["iphone", "android"] as Device[]).map((d) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
              style={{
                background: device === d ? "rgba(255,255,255,0.13)" : "transparent",
                color: device === d ? "white" : "rgba(255,255,255,0.4)",
                boxShadow: device === d ? "0 2px 8px rgba(0,0,0,0.25)" : "none",
              }}
            >
              {d === "iphone" ? (
                <svg viewBox="0 0 384 512" width="14" height="14" fill="currentColor">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                </svg>
              ) : (
                <svg viewBox="0 0 576 512" width="14" height="14" fill="currentColor">
                  <path d="M420.55,301.93a24,24,0,1,1,24-24,24,24,0,0,1-24,24m-265.1,0a24,24,0,1,1,24-24,24,24,0,0,1-24,24m273.7-144.48,47.94-83a10,10,0,1,0-17.27-10h0l-48.54,84.07a301.25,301.25,0,0,0-246.56,0L116.18,64.45a10,10,0,1,0-17.27,10h0l48,83.17C64.64,202.14,16.79,285.34,0,384H576c-16.79-98.66-64.64-181.86-146.85-226.55" />
                </svg>
              )}
              {d === "iphone" ? "آيفون iOS" : "أندرويد"}
            </button>
          ))}
        </div>

        {/* Android instant install banner */}
        {device === "android" && installPrompt && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5"
          >
            <button
              onClick={handleAndroidInstall}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-black text-base shadow-lg transition-all active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${GREEN} 0%, hsl(145,50%,26%) 100%)`,
                color: "white",
                boxShadow: `0 8px 24px ${GREEN}60`,
              }}
            >
              <Smartphone className="w-5 h-5" />
              تثبيت الآن مباشرةً
            </button>
          </motion.div>
        )}

        {/* Steps */}
        <motion.div
          key={device}
          initial={{ opacity: 0, x: device === "android" ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-3 mb-8"
        >
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="flex items-start gap-4 p-4 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-black text-sm"
                style={{ background: `${GOLD}22`, color: GOLD_LIGHT, border: `1.5px solid ${GOLD}44` }}
              >
                {step.num}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-white text-sm leading-snug">{step.title}</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{step.desc}</p>
              </div>
              <div className="shrink-0 mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                {step.icon}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Share section */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <p className="font-black text-white text-sm mb-1">شارك رابط التثبيت</p>
          <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>
            أرسله لطلابك أو ضع الباركود على السبورة
          </p>

          <div className="flex items-center gap-2 mb-4">
            <div
              className="flex-1 px-3 py-2.5 rounded-xl text-xs font-mono truncate"
              style={{ background: "rgba(0,0,0,0.3)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}
              dir="ltr"
            >
              {installUrl}
            </div>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-sm shrink-0 transition-all active:scale-95"
              style={{
                background: copied ? `${GREEN}30` : `${GOLD}20`,
                color: copied ? "hsl(145,65%,55%)" : GOLD_LIGHT,
                border: `1px solid ${copied ? GREEN : GOLD}44`,
              }}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "تم!" : "نسخ"}
            </button>
          </div>

          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-2xl shadow-xl">
              <QRCode value={installUrl} size={148} />
            </div>
          </div>
        </div>

        {/* Note */}
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl mb-6"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <span className="text-xl shrink-0">💡</span>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
            حصاد هو تطبيق ويب تقدمي (PWA). لا يتطلب تنزيلاً من App Store أو Play Store — يُثبَّت مباشرةً من المتصفح ويعمل بدون اتصال للمحتوى المحفوظ.
          </p>
        </div>

        {/* Animated tutorial link */}
        <Link
          href="/install-tutorial"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm transition-all active:scale-98"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.09)" }}
        >
          <span>🎬</span>
          شاهد العرض التعريفي التفاعلي
          <ArrowLeft className="w-3.5 h-3.5" />
        </Link>
      </main>
    </div>
  );
}
