import { useState } from "react";
import QRCode from "react-qr-code";
import { X, QrCode, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface GameQRCodeProps {
  url: string;
  pin: string;
  size?: number;
  className?: string;
}

export function GameQRCode({ url, pin, size = 160, className = "" }: GameQRCodeProps) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="bg-white p-3 rounded-2xl shadow-lg">
        <QRCode value={url} size={size} />
      </div>
      <p className="text-xs text-center opacity-70 font-bold" dir="ltr">{pin}</p>
    </div>
  );
}

interface QRModalButtonProps {
  url: string;
  pin: string;
  label?: string;
  variant?: "dark" | "light";
}

export function QRModalButton({ url, pin, label, variant = "light" }: QRModalButtonProps) {
  const [open, setOpen] = useState(false);

  const downloadQR = () => {
    const svg = document.getElementById("game-qr-svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const canvas = document.createElement("canvas");
    const img = new Image();
    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 300, 300);
      ctx.drawImage(img, 0, 0, 300, 300);
      const a = document.createElement("a");
      a.download = `game-qr-${pin}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgStr)));
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-sm transition-all ${
          variant === "dark"
            ? "bg-white/15 hover:bg-white/25 text-white border border-white/20"
            : "bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-800/40 text-purple-700 dark:text-purple-300"
        }`}
      >
        <QrCode className="w-4 h-4" />
        {label || "QR"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-5 max-w-xs w-full"
            >
              <div className="flex items-center justify-between w-full">
                <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-purple-500" />
                  باركود اللعبة
                </h3>
                <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-white p-4 rounded-2xl shadow-md border border-gray-100">
                <QRCode id="game-qr-svg" value={url} size={220} />
              </div>

              <div className="text-center">
                <p className="text-3xl font-black tracking-[0.3em] text-purple-700 dark:text-purple-300 font-mono" dir="ltr">
                  {pin}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-all max-w-[240px]">{url}</p>
              </div>

              <button
                onClick={downloadQR}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                تحميل الباركود
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

interface InlineQRProps {
  url: string;
  pin: string;
}

export function InlineQR({ url, pin }: InlineQRProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
      >
        <QrCode className="w-3.5 h-3.5" />
        {expanded ? "إخفاء" : "باركود"}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-2"
          >
            <div className="bg-white p-2 rounded-xl">
              <QRCode value={url} size={80} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
