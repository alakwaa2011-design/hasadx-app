import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Link as LinkIcon, QrCode, X, Download } from "lucide-react";
import QRCode from "react-qr-code";
import { useI18n } from "@/lib/i18n";

interface HostJoinBarProps {
  pin: string;
  joinUrl: string;
  variant?: "dark" | "light";
  compact?: boolean;
}

export function HostJoinBar({ pin, joinUrl, variant = "dark", compact = false }: HostJoinBarProps) {
  const { lang } = useI18n();
  const [copied, setCopied] = useState<"link" | "pin" | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const copy = async (value: string, what: "link" | "pin") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(c => (c === what ? null : c)), 1500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      document.body.removeChild(ta);
      setCopied(what);
      setTimeout(() => setCopied(c => (c === what ? null : c)), 1500);
    }
  };

  const downloadQR = () => {
    const svg = document.getElementById(`host-qr-svg-${pin}`);
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const canvas = document.createElement("canvas");
    const img = new Image();
    img.onload = () => {
      canvas.width = 360;
      canvas.height = 360;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 360, 360);
      ctx.drawImage(img, 0, 0, 360, 360);
      const a = document.createElement("a");
      a.download = `million-qr-${pin}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgStr)));
  };

  const isDark = variant === "dark";
  const baseChip = isDark
    ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
    : "bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200";
  const accentChip = isDark
    ? "bg-amber-500/20 text-amber-200 border border-amber-400/30"
    : "bg-amber-100 text-amber-800 border border-amber-300";
  const linkLabel = lang === "ar" ? (copied === "link" ? "تم النسخ" : "نسخ الرابط") : (copied === "link" ? "Copied" : "Copy link");
  const pinLabel = lang === "ar" ? (copied === "pin" ? "تم النسخ" : "نسخ الرقم") : (copied === "pin" ? "Copied" : "Copy PIN");
  const qrLabel = lang === "ar" ? "باركود" : "QR";

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "p-3 rounded-2xl"} ${
        compact
          ? ""
          : isDark
            ? "bg-white/5 border border-white/10"
            : "bg-white border border-gray-200 shadow-sm"
      }`}>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl font-black tracking-[0.25em] ${accentChip}`} dir="ltr">
          <span className={`text-[10px] font-bold tracking-normal ${isDark ? "text-amber-300/70" : "text-amber-600"}`}>PIN</span>
          <span className="text-base sm:text-lg">{pin}</span>
        </div>
        <button
          type="button"
          onClick={() => copy(pin, "pin")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${baseChip}`}
        >
          {copied === "pin" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {pinLabel}
        </button>
        <button
          type="button"
          onClick={() => copy(joinUrl, "link")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${baseChip}`}
        >
          {copied === "link" ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
          {linkLabel}
        </button>
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${baseChip}`}
        >
          <QrCode className="w-4 h-4" />
          {qrLabel}
        </button>
      </div>

      <AnimatePresence>
        {qrOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
            onClick={() => setQrOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full"
            >
              <div className="flex items-center justify-between w-full">
                <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-purple-500" />
                  {lang === "ar" ? "امسح الباركود للانضمام" : "Scan to join"}
                </h3>
                <button onClick={() => setQrOpen(false)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-white p-4 rounded-2xl shadow-md border border-gray-100">
                <QRCode id={`host-qr-svg-${pin}`} value={joinUrl} size={240} />
              </div>

              <div className="text-center space-y-1">
                <p className="text-3xl font-black tracking-[0.3em] text-purple-700 dark:text-purple-300 font-mono" dir="ltr">{pin}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 break-all max-w-[260px]">{joinUrl}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full">
                <button
                  onClick={() => copy(joinUrl, "link")}
                  className="py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 font-bold flex items-center justify-center gap-2"
                >
                  {copied === "link" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {lang === "ar" ? "نسخ الرابط" : "Copy link"}
                </button>
                <button
                  onClick={downloadQR}
                  className="py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {lang === "ar" ? "تحميل" : "Download"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
